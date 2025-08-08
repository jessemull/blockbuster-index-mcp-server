import { S3BlsLoader } from './s3-bls-loader';
import { S3Client } from '@aws-sdk/client-s3';
import { logger } from '../../util';
import { BlsCsvRecord } from '../../types/bls';

jest.mock('@aws-sdk/client-s3');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('S3BlsLoader', () => {
  let s3BlsLoader: S3BlsLoader;
  const mockBucketName = 'test-bucket';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_REGION = 'us-west-2';
    s3BlsLoader = new S3BlsLoader(mockBucketName);
  });

  describe('constructor', () => {
    it('should create S3BlsLoader with bucket name', () => {
      expect(s3BlsLoader).toBeInstanceOf(S3BlsLoader);
      expect(mockS3Client).toHaveBeenCalledWith({ region: 'us-west-2' });
    });

    it('should use default region when AWS_REGION is not set', () => {
      delete process.env.AWS_REGION;
      new S3BlsLoader(mockBucketName);
      expect(mockS3Client).toHaveBeenCalledWith({ region: undefined });
    });
  });

  describe('listAvailableYears', () => {
    it('should return sorted list of available years', async () => {
      const mockResponse = {
        Contents: [
          { Key: '2020.annual.singlefile.csv' },
          { Key: '2019.annual.singlefile.csv' },
          { Key: '2021.annual.singlefile.csv' },
          { Key: 'invalid.txt' },
          { Key: '2022.annual.singlefile.csv' },
        ],
      };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const result = await s3BlsLoader.listAvailableYears();

      expect(result).toEqual(['2019', '2020', '2021', '2022']);
      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should return empty array when no CSV files exist', async () => {
      const mockResponse = {
        Contents: [{ Key: 'invalid.txt' }, { Key: 'test.json' }],
      };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const result = await s3BlsLoader.listAvailableYears();

      expect(result).toEqual([]);
    });

    it('should return empty array when no objects exist', async () => {
      const mockResponse = { Contents: undefined };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const result = await s3BlsLoader.listAvailableYears();

      expect(result).toEqual([]);
    });

    it('should handle S3 errors and rethrow', async () => {
      const mockError = new Error('S3 error');
      const mockSend = jest.fn().mockRejectedValue(mockError);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      await expect(s3BlsLoader.listAvailableYears()).rejects.toThrow(
        'S3 error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to list available years from S3',
        {
          error: 'S3 error',
          bucket: mockBucketName,
        },
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      const mockError = 'String error';
      const mockSend = jest.fn().mockRejectedValue(mockError);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      await expect(s3BlsLoader.listAvailableYears()).rejects.toBe(
        'String error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to list available years from S3',
        {
          error: 'String error',
          bucket: mockBucketName,
        },
      );
    });
  });

  describe('downloadAndParseCsv', () => {
    it('should download and parse CSV successfully', async () => {
      const mockCsvData =
        'area_fips,own_code,industry_code\n12345,5,442110\n67890,5,454110';
      const mockStream = createMockReadableStream(mockCsvData);

      const mockResponse = {
        Body: mockStream,
      };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const result = await s3BlsLoader.downloadAndParseCsv('2020');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        area_fips: '12345',
        own_code: '5',
        industry_code: '442110',
        agglvl_code: '',
        size_code: '',
        year: '',
        annual_avg_emplvl: '',
        annual_avg_estabs: '',
        total_annual_wages: '',
        taxable_annual_wages: '',
        annual_contributions: '',
        annual_avg_wkly_wage: '',
        avg_annual_pay: '',
        lq_annual_avg_emplvl: '',
        lq_annual_avg_estabs: '',
        lq_total_annual_wages: '',
        lq_taxable_annual_wages: '',
        lq_annual_contributions: '',
        lq_annual_avg_wkly_wage: '',
        lq_avg_annual_pay: '',
        oty_total_annual_wages_pct: '',
        oty_annual_avg_emplvl_pct: '',
        oty_annual_avg_estabs_pct: '',
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Downloading BLS CSV for year 2020 from S3',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully parsed 2 records for year 2020',
      );
    });

    it('should throw error when response has no body', async () => {
      const mockResponse = { Body: null };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      await expect(s3BlsLoader.downloadAndParseCsv('2020')).rejects.toThrow(
        'No body in S3 response for year 2020',
      );
    });

    it('should handle S3 errors and rethrow', async () => {
      const mockError = new Error('S3 download error');
      const mockSend = jest.fn().mockRejectedValue(mockError);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      await expect(s3BlsLoader.downloadAndParseCsv('2020')).rejects.toThrow(
        'S3 download error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to download and parse CSV for year 2020',
        {
          error: 'S3 download error',
          bucket: mockBucketName,
          key: '2020.annual.singlefile.csv',
        },
      );
    });
  });

  describe('processCsvInChunks', () => {
    it('should process CSV in chunks successfully', async () => {
      const mockCsvData =
        'area_fips,own_code,industry_code\n12345,5,442110\n67890,5,454110\n11111,5,443110';
      const mockStream = createMockReadableStream(mockCsvData);

      const mockResponse = {
        Body: mockStream,
      };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const chunks: BlsCsvRecord[][] = [];
      for await (const chunk of s3BlsLoader.processCsvInChunks('2020', 2)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(2);
      expect(chunks[1]).toHaveLength(1);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing BLS CSV for year 2020 in chunks of 2',
      );
    });

    it('should throw error when response has no body', async () => {
      const mockResponse = { Body: null };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const generator = s3BlsLoader.processCsvInChunks('2020');
      await expect(generator.next()).rejects.toThrow(
        'No body in S3 response for year 2020',
      );
    });

    it('should handle S3 errors and rethrow', async () => {
      const mockError = new Error('S3 chunk error');
      const mockSend = jest.fn().mockRejectedValue(mockError);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const generator = s3BlsLoader.processCsvInChunks('2020');
      await expect(generator.next()).rejects.toThrow('S3 chunk error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process CSV for year 2020',
        {
          error: 'S3 chunk error',
          bucket: mockBucketName,
          key: '2020.annual.singlefile.csv',
        },
      );
    });
  });

  describe('getFileSize', () => {
    it('should return file size successfully', async () => {
      const mockResponse = {
        ContentLength: 1024,
      };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const result = await s3BlsLoader.getFileSize('2020');

      expect(result).toBe(1024);
      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should return 0 when ContentLength is undefined', async () => {
      const mockResponse = {
        ContentLength: undefined,
      };

      const mockSend = jest.fn().mockResolvedValue(mockResponse);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      const result = await s3BlsLoader.getFileSize('2020');

      expect(result).toBe(0);
    });

    it('should handle S3 errors and rethrow', async () => {
      const mockError = new Error('S3 size error');
      const mockSend = jest.fn().mockRejectedValue(mockError);
      (s3BlsLoader as any).s3Client = { send: mockSend };

      await expect(s3BlsLoader.getFileSize('2020')).rejects.toThrow(
        'S3 size error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get file size for year 2020',
        {
          error: 'S3 size error',
          bucket: mockBucketName,
          key: '2020.annual.singlefile.csv',
        },
      );
    });
  });

  describe('parseCsvLine', () => {
    it('should parse header line correctly', () => {
      const headers: string[] = [];
      const result = (s3BlsLoader as any).parseCsvLine(
        'area_fips,own_code,industry_code',
        headers,
        0,
      );

      expect(result).toBe('area_fips,own_code,industry_code');
    });

    it('should parse data line correctly', () => {
      const headers = ['area_fips', 'own_code', 'industry_code'];
      const result = (s3BlsLoader as any).parseCsvLine(
        '12345,5,442110',
        headers,
        1,
      ) as BlsCsvRecord;

      expect(result).toEqual({
        area_fips: '12345',
        own_code: '5',
        industry_code: '442110',
        agglvl_code: '',
        size_code: '',
        year: '',
        annual_avg_emplvl: '',
        annual_avg_estabs: '',
        total_annual_wages: '',
        taxable_annual_wages: '',
        annual_contributions: '',
        annual_avg_wkly_wage: '',
        avg_annual_pay: '',
        lq_annual_avg_emplvl: '',
        lq_annual_avg_estabs: '',
        lq_total_annual_wages: '',
        lq_taxable_annual_wages: '',
        lq_annual_contributions: '',
        lq_annual_avg_wkly_wage: '',
        lq_avg_annual_pay: '',
        oty_total_annual_wages_pct: '',
        oty_annual_avg_emplvl_pct: '',
        oty_annual_avg_estabs_pct: '',
      });
    });

    it('should return null for malformed line', () => {
      const headers = ['area_fips', 'own_code', 'industry_code'];
      const result = (s3BlsLoader as any).parseCsvLine('12345,5', headers, 1);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping malformed line 2: expected 3 columns, got 2',
      );
    });

    it('should handle empty values correctly', () => {
      const headers = ['area_fips', 'own_code', 'industry_code'];
      const result = (s3BlsLoader as any).parseCsvLine(
        ',,',
        headers,
        1,
      ) as BlsCsvRecord;

      expect(result.area_fips).toBe('');
      expect(result.own_code).toBe('');
      expect(result.industry_code).toBe('');
    });
  });

  describe('parseCsvValues', () => {
    it('should parse simple CSV values', () => {
      const result = (s3BlsLoader as any).parseCsvValues('a,b,c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values', () => {
      const result = (s3BlsLoader as any).parseCsvValues('a,"b,c",d');
      expect(result).toEqual(['a', 'b,c', 'd']);
    });

    it('should handle empty values', () => {
      const result = (s3BlsLoader as any).parseCsvValues('a,,c');
      expect(result).toEqual(['a', '', 'c']);
    });

    it('should handle trailing comma', () => {
      const result = (s3BlsLoader as any).parseCsvValues('a,b,');
      expect(result).toEqual(['a', 'b', '']);
    });

    it('should handle leading comma', () => {
      const result = (s3BlsLoader as any).parseCsvValues(',a,b');
      expect(result).toEqual(['', 'a', 'b']);
    });

    it('should handle quoted values with commas', () => {
      const result = (s3BlsLoader as any).parseCsvValues('"a,b",c,"d,e"');
      expect(result).toEqual(['a,b', 'c', 'd,e']);
    });

    it('should handle nested quotes', () => {
      const result = (s3BlsLoader as any).parseCsvValues('"a""b",c');
      expect(result).toEqual(['ab', 'c']);
    });
  });

  describe('parseCsvStream', () => {
    it('should parse CSV stream successfully', async () => {
      const mockCsvData =
        'area_fips,own_code,industry_code\n12345,5,442110\n67890,5,454110';
      const mockStream = createMockReadableStream(mockCsvData);

      const result = await (s3BlsLoader as any).parseCsvStream(
        mockStream,
        '2020',
      );

      expect(result).toHaveLength(2);
      expect(result[0].area_fips).toBe('12345');
      expect(result[1].area_fips).toBe('67890');
    });

    it('should handle empty CSV file', async () => {
      const mockStream = createMockReadableStream('');

      const result = await (s3BlsLoader as any).parseCsvStream(
        mockStream,
        '2020',
      );
      expect(result).toEqual([]);
    });

    it('should handle CSV with only headers', async () => {
      const mockStream = createMockReadableStream(
        'area_fips,own_code,industry_code',
      );

      const result = await (s3BlsLoader as any).parseCsvStream(
        mockStream,
        '2020',
      );

      expect(result).toHaveLength(0);
    });

    it('should handle CSV with malformed headers', async () => {
      const mockStream = createMockReadableStream(
        'area_fips,own_code\n12345,5,442110',
      );

      const result = await (s3BlsLoader as any).parseCsvStream(
        mockStream,
        '2020',
      );

      expect(result).toHaveLength(0);
    });

    it('should handle CSV with empty headers', async () => {
      const mockStream = createMockReadableStream('\n12345,5,442110');

      const result = await (s3BlsLoader as any).parseCsvStream(
        mockStream,
        '2020',
      );
      expect(result).toEqual([]);
    });

    it('should handle buffer size limit', async () => {
      const largeCsvData =
        'area_fips,own_code,industry_code\n' + '12345,5,442110\n'.repeat(50000);
      const mockStream = createMockReadableStream(largeCsvData);

      const result = await (s3BlsLoader as any).parseCsvStream(
        mockStream,
        '2020',
      );

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('parseCsvStreamInChunks', () => {
    it('should parse CSV stream in chunks successfully', async () => {
      const mockCsvData =
        'area_fips,own_code,industry_code\n12345,5,442110\n67890,5,454110\n11111,5,443110';
      const mockStream = createMockReadableStream(mockCsvData);

      const chunks: BlsCsvRecord[][] = [];
      for await (const chunk of (s3BlsLoader as any).parseCsvStreamInChunks(
        mockStream,
        '2020',
        2,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(2);
      expect(chunks[1]).toHaveLength(1);
    });

    it('should handle empty CSV file in chunks', async () => {
      const mockStream = createMockReadableStream('');

      const chunks: BlsCsvRecord[][] = [];
      for await (const chunk of (s3BlsLoader as any).parseCsvStreamInChunks(
        mockStream,
        '2020',
        2,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([]);
    });

    it('should handle buffer size limit in chunks', async () => {
      const largeCsvData =
        'area_fips,own_code,industry_code\n' + '12345,5,442110\n'.repeat(50000);
      const mockStream = createMockReadableStream(largeCsvData);

      const chunks: BlsCsvRecord[][] = [];
      for await (const chunk of (s3BlsLoader as any).parseCsvStreamInChunks(
        mockStream,
        '2020',
        2,
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle chunk size limits in remaining buffer processing', async () => {
      const csvData =
        'area_fips,own_code,industry_code\n' + '12345,5,442110\n'.repeat(10);
      const mockStream = createMockReadableStream(csvData);

      const chunks: BlsCsvRecord[][] = [];
      for await (const chunk of (s3BlsLoader as any).parseCsvStreamInChunks(
        mockStream,
        '2020',
        3,
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle CSV with empty headers in chunks', async () => {
      const mockStream = createMockReadableStream('\n12345,5,442110');

      const chunks: BlsCsvRecord[][] = [];
      for await (const chunk of (s3BlsLoader as any).parseCsvStreamInChunks(
        mockStream,
        '2020',
        2,
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([]);
    });
  });
});

function createMockReadableStream(data: string): {
  transformToWebStream: () => ReadableStream;
} {
  const encoder = new TextEncoder();
  const chunks = encoder.encode(data);

  return {
    transformToWebStream: () => {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(chunks);
          controller.close();
        },
      });
    },
  };
}
