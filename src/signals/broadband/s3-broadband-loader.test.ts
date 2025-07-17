import {
  S3BroadbandLoader,
  mapTechCodeToTechnology,
} from './s3-broadband-loader';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { parse, Parser } from 'csv-parse';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband';
import type { S3BroadbandCsvRecord } from '../../types/broadband';
import type { Readable } from 'stream';
import { TECHNOLOGY_CODES } from '../../constants';
import { logger } from '../../util/logger';

jest.mock('../../util/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('csv-parse', () => ({
  parse: jest.fn(),
}));

jest.mock('../../repositories/broadband');

const s3Mock = mockClient(S3Client);

describe('mapTechCodeToTechnology', () => {
  it('should map tech codes to technology names', () => {
    expect(mapTechCodeToTechnology('70')).toBe('Fiber'); // already tested
    expect(mapTechCodeToTechnology('50')).toBe('Other'); // already tested
    expect(mapTechCodeToTechnology('999')).toBe('Unknown'); // already tested
  });

  it('should return Cable for matching cable tech code', () => {
    expect(mapTechCodeToTechnology(String(TECHNOLOGY_CODES.CABLE[0]))).toBe(
      'Cable',
    );
  });

  it('should return DSL for matching DSL tech code', () => {
    expect(mapTechCodeToTechnology(String(TECHNOLOGY_CODES.DSL[0]))).toBe(
      'DSL',
    );
  });

  it('should return Wireless for matching wireless tech code', () => {
    expect(mapTechCodeToTechnology(String(TECHNOLOGY_CODES.WIRELESS[0]))).toBe(
      'Wireless',
    );
  });
});

describe('S3BroadbandLoader', () => {
  const bucket = 'test-bucket';
  let loader: S3BroadbandLoader;

  beforeEach(() => {
    s3Mock.reset();
    loader = new S3BroadbandLoader(bucket);
  });

  describe('getLatestDataVersion', () => {
    it('returns null when no prefixes found', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({});
      const version = await loader.getLatestDataVersion();
      expect(version).toBeNull();
    });

    it('returns latest version', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        CommonPrefixes: [{ Prefix: 'Dec2021-v1/' }, { Prefix: 'Dec2023-v1/' }],
      });
      const version = await loader.getLatestDataVersion();
      expect(version).toBe('Dec2023-v1');
    });

    it('handles S3 errors gracefully', async () => {
      s3Mock.on(ListObjectsV2Command).rejects(new Error('S3 error'));
      const version = await loader.getLatestDataVersion();
      expect(version).toBeNull();
    });
  });

  describe('listStateFiles', () => {
    it('returns empty list when no contents', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({});
      const files = await loader.listStateFiles('Dec2023-v1');
      expect(files).toEqual([]);
    });

    it('filters and returns CSV files', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'Dec2023-v1/CA-Fixed-Dec2023-v1.csv' },
          { Key: 'Dec2023-v1/README.txt' },
        ],
      });
      const files = await loader.listStateFiles('Dec2023-v1');
      expect(files).toEqual(['Dec2023-v1/CA-Fixed-Dec2023-v1.csv']);
    });

    it('handles S3 errors', async () => {
      s3Mock.on(ListObjectsV2Command).rejects(new Error('fail'));
      const files = await loader.listStateFiles('Dec2023-v1');
      expect(files).toEqual([]);
    });
  });

  describe('downloadAndParseCSV', () => {
    const mockStream = { pipe: jest.fn() } as unknown as Readable;

    beforeEach(() => {
      const parser: Partial<Parser> = {
        on: jest.fn(() => {
          return parser;
        }) as any,
        read: jest.fn(),
      };

      (parse as jest.Mock).mockImplementation(() => parser);
    });

    it('throws if no body returned', async () => {
      s3Mock.on(GetObjectCommand).resolves({});
      await expect(loader.downloadAndParseCSV('bad-key')).rejects.toThrow();
    });

    it('throws if state cannot be parsed from filename', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: mockStream } as any);
      await expect(loader.downloadAndParseCSV('invalid.csv')).rejects.toThrow();
    });

    it('parses valid CSV stream correctly', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: mockStream } as any);

      const mockRead = jest
        .fn()
        .mockReturnValueOnce({
          StateAbbr: 'CA',
          BlockCode: '123',
          ProviderName: 'X',
          TechCode: '70',
          MaxAdDown: '500',
        } satisfies S3BroadbandCsvRecord)
        .mockReturnValueOnce(null);

      (parse as jest.Mock).mockReturnValueOnce({
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'readable') setTimeout(cb, 10);
          if (event === 'end') setTimeout(cb, 20);
          return this;
        }),
        read: mockRead,
      });

      const result = await loader.downloadAndParseCSV(
        'Dec2023-v1/CA-Fixed-Dec2023-v1.csv',
      );
      expect(result[0]).toMatchObject({
        state: 'CA',
        censusBlock: '123',
        provider: 'X',
        speed: 500,
        technology: 'Fiber',
      });
    });

    it('handles CSV parse error', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: mockStream } as any);

      const parser = {
        on: jest.fn().mockReturnThis(),
        read: jest.fn(),
      };

      (parse as jest.Mock).mockReturnValueOnce(parser);

      const promise = loader.downloadAndParseCSV(
        'Dec2023-v1/CA-Fixed-Dec2023-v1.csv',
      );

      setTimeout(() => {
        parser.on.mock.calls.forEach(
          ([event, cb]: [string, (...args: any[]) => void]) => {
            if (event === 'error') cb(new Error('parser fail'));
          },
        );
      }, 0);

      await expect(promise).rejects.toThrow('parser fail');
    });
  });

  describe('checkIfStateExists', () => {
    it('returns true if state exists', async () => {
      (DynamoDBBroadbandSignalRepository as jest.Mock).mockImplementation(
        () => ({
          getByStateAndVersion: jest.fn().mockResolvedValue({}),
        }),
      );
      const result = await loader['checkIfStateExists']('CA', 'Dec2023-v1');
      expect(result).toBe(true);
    });

    it('returns false and logs error on exception', async () => {
      (DynamoDBBroadbandSignalRepository as jest.Mock).mockImplementation(
        () => ({
          getByStateAndVersion: jest.fn().mockRejectedValue(new Error('fail')),
        }),
      );
      const result = await loader['checkIfStateExists']('CA', 'Dec2023-v1');
      expect(result).toBe(false);
    });
  });

  describe('loadBroadbandData', () => {
    it('returns empty if no version', async () => {
      jest.spyOn(loader, 'getLatestDataVersion').mockResolvedValue(null);
      const result = await loader.loadBroadbandData();
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('No data version found in S3');
    });

    it('returns empty if no state files for version', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest.spyOn(loader, 'listStateFiles').mockResolvedValue([]);
      const result = await loader.loadBroadbandData();
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'No state files found for version Dec2023-v1',
      );
    });

    it('skips files with download errors but continues', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest
        .spyOn(loader, 'listStateFiles')
        .mockResolvedValue(['bad.csv', 'good.csv']);
      jest
        .spyOn(loader, 'downloadAndParseCSV')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce([
          {
            state: 'CA',
            censusBlock: '',
            provider: '',
            technology: '',
            speed: 0,
          },
        ]);

      const result = await loader.loadBroadbandData();
      expect(result.length).toBe(1);
    });
  });

  describe('processStatesOneByOne', () => {
    it('returns early and warns if no data version', async () => {
      jest.spyOn(loader, 'getLatestDataVersion').mockResolvedValue(null);
      const callback = jest.fn();
      await loader.processStatesOneByOne(callback);
      expect(logger.warn).toHaveBeenCalledWith('No data version found in S3');
      expect(callback).not.toHaveBeenCalled();
    });

    it('returns early and warns if no state files', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest.spyOn(loader, 'listStateFiles').mockResolvedValue([]);
      const callback = jest.fn();
      await loader.processStatesOneByOne(callback);
      expect(logger.warn).toHaveBeenCalledWith(
        'No state files found for version Dec2023-v1',
      );
      expect(callback).not.toHaveBeenCalled();
    });

    it('skips file with bad state parse', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest.spyOn(loader, 'listStateFiles').mockResolvedValue(['invalid.csv']);
      const callback = jest.fn();
      await loader.processStatesOneByOne(callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('skips if state exists in DynamoDB', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest
        .spyOn(loader, 'listStateFiles')
        .mockResolvedValue(['Dec2023-v1/CA-Fixed-Dec2023-v1.csv']);
      jest.spyOn(loader as any, 'checkIfStateExists').mockResolvedValue(true);
      const callback = jest.fn();
      await loader.processStatesOneByOne(callback);
      expect(logger.info).toHaveBeenCalledWith(
        'State CA version Dec2023-v1 already exists in DynamoDB, skipping download',
      );
      expect(callback).not.toHaveBeenCalled();
    });

    it('uses Unknown as state if regex does not match', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest
        .spyOn(loader, 'listStateFiles')
        .mockResolvedValue(['Dec2023-v1/invalidfile.csv']);
      jest.spyOn(loader, 'downloadAndParseCSV').mockResolvedValue([]);
      const result = await loader.loadBroadbandData();
      expect(result[0].state).toBe('Unknown');
    });

    it('maps all defaults when CSV fields are missing', async () => {
      const s3Key = 'Dec2023-v1/CA-Fixed-Dec2023-v1.csv';
      const mockStream = { pipe: jest.fn() } as any;
      const parser: any = {
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'readable') setTimeout(cb, 10);
          if (event === 'end') setTimeout(cb, 20);
          return parser;
        }),
        read: jest
          .fn()
          .mockReturnValueOnce({}) // All fields missing
          .mockReturnValueOnce(null),
      };
      (parse as any).mockReturnValueOnce(parser);
      s3Mock.on(GetObjectCommand).resolves({ Body: mockStream } as any);
      const records = await loader.downloadAndParseCSV(s3Key);
      expect(records[0]).toEqual({
        state: 'CA',
        censusBlock: '',
        provider: '',
        technology: 'Unknown',
        speed: 0,
      });
    });

    it('calls callback with downloaded data', async () => {
      jest
        .spyOn(loader, 'getLatestDataVersion')
        .mockResolvedValue('Dec2023-v1');
      jest
        .spyOn(loader, 'listStateFiles')
        .mockResolvedValue(['Dec2023-v1/CA-Fixed-Dec2023-v1.csv']);
      jest.spyOn(loader as any, 'checkIfStateExists').mockResolvedValue(false);
      jest.spyOn(loader, 'downloadAndParseCSV').mockResolvedValue([
        {
          state: 'CA',
          censusBlock: '',
          provider: '',
          technology: '',
          speed: 0,
        },
      ]);

      const callback = jest.fn();
      await loader.processStatesOneByOne(callback);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  it('returns null when CommonPrefixes exist but versions array is empty', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [{ Prefix: undefined }, { Prefix: '' }],
    });
    const version = await loader.getLatestDataVersion();
    expect(version).toBeNull();
  });
});
