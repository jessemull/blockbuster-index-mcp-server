// Mocks for class methods (declare early)
const mockSave = jest.fn();
const mockGet = jest.fn();

// Mock DynamoDBBroadbandSignalRepository before importing getBroadbandScores
jest.mock('../../repositories/broadband-signal-repository', () => {
  return {
    DynamoDBBroadbandSignalRepository: jest.fn().mockImplementation(() => ({
      save: mockSave,
      get: mockGet,
    })),
  };
});

// Mock other dependencies
jest.mock('../../util/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../services/broadband-service');
jest.mock('./scrape-broadband-data');
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));
jest.mock('path', () => ({
  resolve: jest.fn(),
  join: jest.fn(),
}));

// Mock loadExistingBroadbandData explicitly
jest.mock('./load-existing-broadband-data', () => ({
  loadExistingBroadbandData: jest.fn(),
}));

// Now import after mocks are set up
import { getBroadbandScores } from './get-broadband-scores';
import { BroadbandService } from '../../services/broadband-service';
import { scrapeBroadbandData } from './scrape-broadband-data';
import { logger } from '../../util/logger';
import * as fs from 'fs';
import * as path from 'path';

import { loadExistingBroadbandData } from './load-existing-broadband-data';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

const mockProcessCsv = jest.fn();
(BroadbandService as jest.Mock).mockImplementation(() => ({
  processBroadbandCsv: mockProcessCsv,
}));

// Now cast the imported loadExistingBroadbandData as a Jest mock function
const mockLoadExistingBroadbandData =
  loadExistingBroadbandData as jest.MockedFunction<
    typeof loadExistingBroadbandData
  >;

// Override getCurrentFccDataVersion mock
jest.mock('./get-broadband-scores.ts', () => {
  const actual = jest.requireActual('./get-broadband-scores.ts');
  return {
    ...actual,
    getCurrentFccDataVersion: jest.fn().mockResolvedValue('Dec 21v1'),
  };
});

// Helper for filenames
function createFileName(name: string): string {
  return name;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BROADBAND_DYNAMODB_TABLE_NAME = 'mock-table';
});

describe('getBroadbandScores', () => {
  it('scrapes and stores data when scraping is needed', async () => {
    process.env.FORCE_REFRESH = 'true';
    mockFs.existsSync.mockReturnValue(true);
    (mockFs.readdirSync as jest.Mock).mockReturnValue([
      createFileName('CA.csv'),
    ]);
    mockPath.resolve.mockReturnValue('/mocked/path');
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));

    mockProcessCsv.mockResolvedValue({
      CA: { broadbandScore: 85, someMetric: 1 },
    });

    const result = await getBroadbandScores();

    expect(scrapeBroadbandData).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'CA', broadbandScore: 85 }),
    );
    expect(result['CA']).toBe(85);
  });

  it('returns empty scores if data dir does not exist after scraping', async () => {
    process.env.FORCE_REFRESH = 'true';
    mockFs.existsSync.mockReturnValue(false);

    const result = await getBroadbandScores();
    expect(result).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      'Scraper did not create data directory, using default scores',
    );
  });

  it('returns empty scores if no CSVs found', async () => {
    process.env.FORCE_REFRESH = 'true';
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);

    const result = await getBroadbandScores();
    expect(result).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      'No CSV files found after scraping, using default scores',
    );
  });

  it('logs and throws on fatal errors', async () => {
    process.env.FORCE_REFRESH = 'true';
    mockFs.existsSync.mockImplementation(() => {
      throw new Error('Boom');
    });

    await expect(getBroadbandScores()).rejects.toThrow('Boom');
    expect(logger.error).toHaveBeenCalledWith(
      'Broadband scores calculation failed',
      expect.any(Error),
    );
  });

  it('logs and skips failed saves', async () => {
    process.env.FORCE_REFRESH = 'true';
    mockFs.existsSync.mockReturnValue(true);
    (mockFs.readdirSync as jest.Mock).mockReturnValue([
      createFileName('CA.csv'),
    ]);
    mockPath.resolve.mockReturnValue('/mocked/path');
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));

    mockProcessCsv.mockResolvedValue({ CA: { broadbandScore: 10 } });
    mockSave.mockRejectedValueOnce(new Error('fail save'));

    await getBroadbandScores();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to store broadband signal for CA',
      expect.any(Error),
    );
  });

  it('handles repository being undefined', async () => {
    delete process.env.BROADBAND_DYNAMODB_TABLE_NAME;
    process.env.FORCE_REFRESH = 'true';
    mockFs.existsSync.mockReturnValue(true);
    (mockFs.readdirSync as jest.Mock).mockReturnValue([
      createFileName('CA.csv'),
    ]);
    mockPath.resolve.mockReturnValue('/mocked/path');
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));

    mockProcessCsv.mockResolvedValue({ CA: { broadbandScore: 99 } });

    const result = await getBroadbandScores();
    expect(result['CA']).toBe(99);
    expect(mockSave).not.toHaveBeenCalled();
  });

  // NEW tests covering the else branch with repository defined
  it('loads existing broadband data when no scraping is needed and repository is defined', async () => {
    process.env.FORCE_REFRESH = 'false';

    // Spy on checkIfScrapingNeeded to return needsScraping: false
    jest
      .spyOn(
        await import('./check-if-scraping-needed'),
        'checkIfScrapingNeeded',
      )
      .mockResolvedValueOnce({
        needsScraping: false,
        currentDataVersion: 'Dec 21v1',
      });

    const mockExisting = { CA: 99, TX: 50 };
    mockLoadExistingBroadbandData.mockResolvedValueOnce(mockExisting);

    const result = await getBroadbandScores();

    expect(logger.info).toHaveBeenCalledWith(
      'Using existing broadband data from database',
    );
    expect(mockLoadExistingBroadbandData).toHaveBeenCalled();
    expect(result).toEqual(mockExisting);
  });

  // NEW test for no repository case in else branch
  it('skips loading existing broadband data when no repository is defined', async () => {
    delete process.env.BROADBAND_DYNAMODB_TABLE_NAME;
    process.env.FORCE_REFRESH = 'false';

    jest
      .spyOn(
        await import('./check-if-scraping-needed'),
        'checkIfScrapingNeeded',
      )
      .mockResolvedValueOnce({
        needsScraping: false,
        currentDataVersion: 'Dec 21v1',
      });

    const result = await getBroadbandScores();

    expect(logger.info).toHaveBeenCalledWith(
      'Using existing broadband data from database',
    );
    expect(mockLoadExistingBroadbandData).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });
});
