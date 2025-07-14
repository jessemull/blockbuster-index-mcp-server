import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { BroadbandService } from './broadband-service';
import { BroadbandCsvRecord } from '../types/broadband';
import { SPEED_THRESHOLDS } from '../constants/broadband';

jest.mock('fs');
jest.mock('../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('csv-parse/sync', () => ({
  parse: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockParse = jest.mocked(parse) as unknown as jest.MockedFunction<
  (input: string, options?: Record<string, unknown>) => BroadbandCsvRecord[]
>;

// Interface for accessing private methods of BroadbandService
interface BroadbandServicePrivate {
  groupRecordsByState(
    records: BroadbandCsvRecord[],
  ): Record<string, BroadbandCsvRecord[]>;
  calculateBroadbandMetrics(
    records: BroadbandCsvRecord[],
  ): import('../types/broadband').BroadbandMetrics;
  countBlocksWithBroadband(records: BroadbandCsvRecord[]): number;
  countBlocksWithSpeed(
    records: BroadbandCsvRecord[],
    speedThreshold: number,
  ): number;
  calculateTechnologyCounts(
    records: BroadbandCsvRecord[],
  ): import('../types/broadband').TechnologyCounts;
  extractSpeeds(records: BroadbandCsvRecord[]): number[];
  calculateAverage(numbers: number[]): number;
  calculateMedian(numbers: number[]): number;
  calculateBroadbandScore(metrics: {
    broadbandAvailabilityPercent: number;
    highSpeedAvailabilityPercent: number;
    gigabitAvailabilityPercent: number;
    technologyCounts: import('../types/broadband').TechnologyCounts;
  }): number;
}

describe('BroadbandService', () => {
  let service: BroadbandService;

  beforeEach(() => {
    service = new BroadbandService();
    jest.clearAllMocks();
  });

  describe('processBroadbandCsv', () => {
    const mockCsvPath = '/path/to/test.csv';
    const mockCsvContent = 'mock csv content';

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockCsvContent);
    });

    it('should process CSV file successfully and return metrics for valid states', async () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'TX',
          BlockCode: '480010001001000',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '50',
          MaxAdUp: '5',
          Business: '1',
        },
      ];

      mockParse.mockReturnValue(mockRecords);

      const result = await service.processBroadbandCsv(mockCsvPath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockCsvPath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockCsvPath, 'utf-8');
      expect(mockParse).toHaveBeenCalledWith(mockCsvContent, {
        columns: true,
        skip_empty_lines: true,
      });

      expect(result).toHaveProperty('CA');
      expect(result).toHaveProperty('TX');
      expect(result.CA).toHaveProperty('totalCensusBlocks');
      expect(result.CA).toHaveProperty('broadbandScore');
      expect(result.TX).toHaveProperty('totalCensusBlocks');
      expect(result.TX).toHaveProperty('broadbandScore');
    });

    it('should throw error when CSV file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(service.processBroadbandCsv(mockCsvPath)).rejects.toThrow(
        `Broadband CSV file not found: ${mockCsvPath}`,
      );
    });

    it('should filter out invalid states', async () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'INVALID',
          BlockCode: '480010001001000',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '50',
          MaxAdUp: '5',
          Business: '1',
        },
      ];

      mockParse.mockReturnValue(mockRecords);

      const result = await service.processBroadbandCsv(mockCsvPath);

      expect(result).toHaveProperty('CA');
      expect(result).not.toHaveProperty('INVALID');
    });

    it('should handle empty CSV file', async () => {
      mockParse.mockReturnValue([]);

      const result = await service.processBroadbandCsv(mockCsvPath);

      expect(result).toEqual({});
    });
  });

  describe('groupRecordsByState', () => {
    it('should group records by state correctly', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'TX',
          BlockCode: '480010001001000',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '50',
          MaxAdUp: '5',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).groupRecordsByState(mockRecords);

      expect(result).toHaveProperty('CA');
      expect(result).toHaveProperty('TX');
      expect(result.CA).toHaveLength(1);
      expect(result.TX).toHaveLength(1);
      expect(result.CA[0].StateAbbr).toBe('CA');
      expect(result.TX[0].StateAbbr).toBe('TX');
    });

    it('should handle records with missing state abbreviation', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: '',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).groupRecordsByState(mockRecords);

      expect(result).toEqual({});
    });

    it('should handle records with whitespace in state abbreviation', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: ' CA ',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).groupRecordsByState(mockRecords);

      expect(result).toHaveProperty('CA');
      expect(result.CA).toHaveLength(1);
    });
  });

  describe('calculateBroadbandMetrics', () => {
    it('should calculate metrics correctly for valid records', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'CA',
          BlockCode: '060010001001001',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '1500',
          MaxAdUp: '50',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandMetrics(mockRecords);

      expect(result.totalCensusBlocks).toBe(2);
      expect(result.blocksWithBroadband).toBe(2);
      expect(result.broadbandAvailabilityPercent).toBe(100);
      expect(result.blocksWithHighSpeed).toBe(2);
      expect(result.highSpeedAvailabilityPercent).toBe(100);
      expect(result.blocksWithGigabit).toBe(1);
      expect(result.gigabitAvailabilityPercent).toBe(50);
      expect(result.technologyCounts.fiber).toBe(1);
      expect(result.technologyCounts.cable).toBe(1);
      expect(result.averageDownloadSpeed).toBe(800);
      expect(result.medianDownloadSpeed).toBe(800);
      expect(result.broadbandScore).toBeGreaterThan(0);
    });

    it('should handle empty records', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandMetrics([]);

      expect(result.totalCensusBlocks).toBe(0);
      expect(result.blocksWithBroadband).toBe(0);
      expect(result.broadbandAvailabilityPercent).toBe(0);
      expect(result.broadbandScore).toBe(0);
    });

    it('should handle records with zero speeds', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '0',
          MaxAdUp: '0',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandMetrics(mockRecords);

      expect(result.totalCensusBlocks).toBe(1);
      expect(result.blocksWithBroadband).toBe(0);
      expect(result.broadbandAvailabilityPercent).toBe(0);
      expect(result.averageDownloadSpeed).toBe(0);
      expect(result.medianDownloadSpeed).toBe(0);
    });
  });

  describe('countBlocksWithBroadband', () => {
    it('should count blocks with broadband service correctly', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'CA',
          BlockCode: '060010001001001',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '0',
          MaxAdUp: '0',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).countBlocksWithBroadband(mockRecords);

      expect(result).toBe(1);
    });

    it('should handle duplicate block codes', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '50',
          MaxAdUp: '5',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).countBlocksWithBroadband(mockRecords);

      expect(result).toBe(1);
    });
  });

  describe('countBlocksWithSpeed', () => {
    it('should count blocks meeting speed threshold', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'CA',
          BlockCode: '060010001001001',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '10',
          MaxAdUp: '1',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).countBlocksWithSpeed(mockRecords, SPEED_THRESHOLDS.BROADBAND_MIN);

      expect(result).toBe(1);
    });

    it('should handle edge case of exact speed threshold', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '25',
          MaxAdUp: '3',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).countBlocksWithSpeed(mockRecords, SPEED_THRESHOLDS.BROADBAND_MIN);

      expect(result).toBe(1);
    });
  });

  describe('calculateTechnologyCounts', () => {
    it('should categorize technology codes correctly', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'CA',
          BlockCode: '060010001001001',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '50',
          MaxAdUp: '5',
          Business: '1',
        },
        {
          LogRecNo: '3',
          Provider_Id: '3',
          FRN: '3',
          ProviderName: 'Test Provider 3',
          DBAName: 'Test DBA 3',
          HoldingCompanyName: 'Test Holding 3',
          HocoNum: '3',
          HocoFinal: '3',
          StateAbbr: 'CA',
          BlockCode: '060010001001002',
          TechCode: '10',
          Consumer: '1',
          MaxAdDown: '25',
          MaxAdUp: '3',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateTechnologyCounts(mockRecords);

      expect(result.fiber).toBe(1);
      expect(result.cable).toBe(1);
      expect(result.dsl).toBe(1);
      expect(result.wireless).toBe(0);
      expect(result.other).toBe(0);
    });

    it('should handle unknown technology codes', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '99',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateTechnologyCounts(mockRecords);

      expect(result.other).toBe(1);
    });
  });

  describe('extractSpeeds', () => {
    it('should extract valid speeds and filter out zero speeds', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: '100',
          MaxAdUp: '10',
          Business: '1',
        },
        {
          LogRecNo: '2',
          Provider_Id: '2',
          FRN: '2',
          ProviderName: 'Test Provider 2',
          DBAName: 'Test DBA 2',
          HoldingCompanyName: 'Test Holding 2',
          HocoNum: '2',
          HocoFinal: '2',
          StateAbbr: 'CA',
          BlockCode: '060010001001001',
          TechCode: '60',
          Consumer: '1',
          MaxAdDown: '0',
          MaxAdUp: '0',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).extractSpeeds(mockRecords);

      expect(result).toEqual([100]);
    });

    it('should handle invalid speed values', () => {
      const mockRecords: BroadbandCsvRecord[] = [
        {
          LogRecNo: '1',
          Provider_Id: '1',
          FRN: '1',
          ProviderName: 'Test Provider',
          DBAName: 'Test DBA',
          HoldingCompanyName: 'Test Holding',
          HocoNum: '1',
          HocoFinal: '1',
          StateAbbr: 'CA',
          BlockCode: '060010001001000',
          TechCode: '70',
          Consumer: '1',
          MaxAdDown: 'invalid',
          MaxAdUp: '10',
          Business: '1',
        },
      ];

      const result = (
        service as unknown as BroadbandServicePrivate
      ).extractSpeeds(mockRecords);

      expect(result).toEqual([]);
    });
  });

  describe('calculateAverage', () => {
    it('should calculate average correctly', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateAverage([1, 2, 3, 4, 5]);

      expect(result).toBe(3);
    });

    it('should handle empty array', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateAverage([]);

      expect(result).toBe(0);
    });

    it('should handle single number', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateAverage([42]);

      expect(result).toBe(42);
    });
  });

  describe('calculateMedian', () => {
    it('should calculate median for odd length array', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateMedian([1, 2, 3, 4, 5]);

      expect(result).toBe(3);
    });

    it('should calculate median for even length array', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateMedian([1, 2, 3, 4]);

      expect(result).toBe(2.5);
    });

    it('should handle empty array', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateMedian([]);

      expect(result).toBe(0);
    });

    it('should handle single number', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateMedian([42]);

      expect(result).toBe(42);
    });

    it('should handle unsorted array', () => {
      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateMedian([5, 1, 3, 2, 4]);

      expect(result).toBe(3);
    });
  });

  describe('calculateBroadbandScore', () => {
    it('should calculate broadband score correctly', () => {
      const mockMetrics = {
        broadbandAvailabilityPercent: 100,
        highSpeedAvailabilityPercent: 80,
        gigabitAvailabilityPercent: 60,
        technologyCounts: {
          fiber: 10,
          cable: 5,
          dsl: 3,
          wireless: 2,
          other: 1,
        },
      };

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandScore(mockMetrics);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle zero metrics', () => {
      const mockMetrics = {
        broadbandAvailabilityPercent: 0,
        highSpeedAvailabilityPercent: 0,
        gigabitAvailabilityPercent: 0,
        technologyCounts: {
          fiber: 0,
          cable: 0,
          dsl: 0,
          wireless: 0,
          other: 0,
        },
      };

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandScore(mockMetrics);

      expect(result).toBe(0);
    });

    it('should handle maximum diversity', () => {
      const mockMetrics = {
        broadbandAvailabilityPercent: 100,
        highSpeedAvailabilityPercent: 100,
        gigabitAvailabilityPercent: 100,
        technologyCounts: {
          fiber: 1,
          cable: 1,
          dsl: 1,
          wireless: 1,
          other: 1,
        },
      };

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandScore(mockMetrics);

      expect(result).toBeCloseTo(1, 10);
    });

    it('should clamp score to 0-1 range', () => {
      const mockMetrics = {
        broadbandAvailabilityPercent: 200,
        highSpeedAvailabilityPercent: 200,
        gigabitAvailabilityPercent: 200,
        technologyCounts: {
          fiber: 1000,
          cable: 1000,
          dsl: 1000,
          wireless: 1000,
          other: 1000,
        },
      };

      const result = (
        service as unknown as BroadbandServicePrivate
      ).calculateBroadbandScore(mockMetrics);

      expect(result).toBe(1);
    });
  });
});
