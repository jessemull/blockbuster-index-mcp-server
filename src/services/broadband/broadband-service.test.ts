import { BroadbandService } from './broadband-service';
import { BroadbandCsvRecord } from '../../types/broadband';
import { SPEED_THRESHOLDS } from '../../constants/broadband';
import { logger } from '../../util';

jest.mock('fs');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('csv-parse/sync', () => ({
  parse: jest.fn(),
}));

// Mock the S3BroadbandLoader to avoid AWS SDK import issues
jest.mock('../../signals/broadband/s3-broadband-loader', () => ({
  S3BroadbandLoader: jest.fn().mockImplementation(() => ({
    loadData: jest.fn().mockResolvedValue({
      dataVersion: 'test-version',
      records: [],
    }),
  })),
}));

// Mock the DynamoDB repository
jest.mock('../../repositories/broadband', () => ({
  DynamoDBBroadbandSignalRepository: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    getLatestVersionForState: jest.fn(),
    saveStateVersionMetadata: jest.fn(),
    getAllScores: jest.fn(),
    getByStateAndVersion: jest.fn(),
  })),
}));

// Interface for accessing private methods of BroadbandService
interface BroadbandServicePrivate {
  calculateBroadbandMetrics(
    records: BroadbandCsvRecord[],
  ): import('../../types/broadband').BroadbandMetrics;
  countBlocksWithBroadband(records: BroadbandCsvRecord[]): number;
  countBlocksWithSpeed(
    records: BroadbandCsvRecord[],
    speedThreshold: number,
  ): number;
  calculateTechnologyCounts(
    records: BroadbandCsvRecord[],
  ): import('../../types/broadband').TechnologyCounts;
  extractSpeeds(records: BroadbandCsvRecord[]): number[];
  calculateAverage(numbers: number[]): number;
  calculateMedian(numbers: number[]): number;
  calculateBroadbandScore(metrics: {
    broadbandAvailabilityPercent: number;
    highSpeedAvailabilityPercent: number;
    gigabitAvailabilityPercent: number;
    technologyCounts: import('../../types/broadband').TechnologyCounts;
  }): number;
}

describe('BroadbandService', () => {
  let service: BroadbandService;

  beforeEach(() => {
    service = new BroadbandService();
    jest.clearAllMocks();
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

  describe('processBroadbandData', () => {
    beforeEach(() => {
      // Mock the s3Loader.processStatesOneByOne method
      (service as any).s3Loader = {
        processStatesOneByOne: jest.fn(),
      };
    });

    it('should process broadband data successfully', async () => {
      (service as any).s3Loader.processStatesOneByOne.mockResolvedValue(
        undefined,
      );

      await service.processBroadbandData();

      expect(
        (service as any).s3Loader.processStatesOneByOne,
      ).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle errors during processing', async () => {
      const mockError = new Error('S3 processing failed');
      (service as any).s3Loader.processStatesOneByOne.mockRejectedValue(
        mockError,
      );

      await expect(service.processBroadbandData()).rejects.toThrow(
        'S3 processing failed',
      );
    });

    it('should log start and completion messages', async () => {
      (service as any).s3Loader.processStatesOneByOne.mockResolvedValue(
        undefined,
      );

      await service.processBroadbandData();

      expect(logger.info).toHaveBeenCalledWith(
        'Starting broadband data processing from S3...',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Broadband data processing completed',
      );
    });

    it('should log errors when processing fails', async () => {
      const mockError = new Error('Processing error');
      (service as any).s3Loader.processStatesOneByOne.mockRejectedValue(
        mockError,
      );

      await expect(service.processBroadbandData()).rejects.toThrow(
        'Processing error',
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error in broadband data processing:',
        mockError,
      );
    });
  });

  describe('processStateData', () => {
    let mockRepository: any;
    let mockStateData: any;

    beforeEach(() => {
      mockRepository = {
        save: jest.fn(),
        saveStateVersionMetadata: jest.fn(),
      };
      (service as any).repository = mockRepository;

      mockStateData = {
        state: 'CA',
        metrics: {
          totalCensusBlocks: 2,
          blocksWithBroadband: 2,
          broadbandAvailabilityPercent: 100,
          blocksWithHighSpeed: 2,
          highSpeedAvailabilityPercent: 100,
          blocksWithGigabit: 1,
          gigabitAvailabilityPercent: 50,
          technologyCounts: {
            fiber: 1,
            cable: 1,
            dsl: 0,
            wireless: 0,
            other: 0,
          },
          averageDownloadSpeed: 800,
          medianDownloadSpeed: 800,
          broadbandScore: 0.85,
        },
        dataVersion: 'test-version-1.0',
        lastUpdated: new Date(),
      };
    });

    it('should process state data successfully when should process', async () => {
      // Mock shouldProcessStateData to return true
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(mockStateData);

      expect(mockRepository.save).toHaveBeenCalledTimes(1); // Main record only
      expect(mockRepository.saveStateVersionMetadata).toHaveBeenCalledWith({
        state: 'CA',
        dataVersion: 'test-version-1.0',
        lastProcessed: expect.any(Number),
      });
    });

    it('should skip processing when shouldProcessStateData returns false', async () => {
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(false);

      await (service as any).processStateData(mockStateData);

      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockRepository.saveStateVersionMetadata).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Skipping CA - data version test-version-1.0 already processed',
      );
    });

    it('should handle repository save errors gracefully', async () => {
      const mockError = new Error('DynamoDB save failed');
      mockRepository.save.mockRejectedValue(mockError);
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(mockStateData);

      expect(logger.error).toHaveBeenCalledWith(
        'Error processing state data for CA:',
        mockError,
      );
    });

    it('should handle metadata save errors gracefully', async () => {
      const mockError = new Error('Metadata save failed');
      mockRepository.saveStateVersionMetadata.mockRejectedValue(mockError);
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(mockStateData);

      expect(logger.error).toHaveBeenCalledWith(
        'Error processing state data for CA:',
        mockError,
      );
    });

    it('should convert technology codes correctly', async () => {
      const stateDataWithDifferentTechnologies = {
        state: 'TX',
        metrics: {
          totalCensusBlocks: 5,
          blocksWithBroadband: 5,
          broadbandAvailabilityPercent: 100,
          blocksWithHighSpeed: 5,
          highSpeedAvailabilityPercent: 100,
          blocksWithGigabit: 1,
          gigabitAvailabilityPercent: 20,
          technologyCounts: {
            fiber: 1,
            cable: 1,
            dsl: 1,
            wireless: 1,
            other: 1,
          },
          averageDownloadSpeed: 335,
          medianDownloadSpeed: 100,
          broadbandScore: 0.9,
        },
        dataVersion: 'test-version-2.0',
        lastUpdated: new Date(),
      };

      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(
        stateDataWithDifferentTechnologies,
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'TX',
          dataVersion: 'test-version-2.0',
          technologyCounts: expect.objectContaining({
            fiber: 1,
            cable: 1,
            dsl: 1,
            wireless: 1,
            other: 1,
          }),
        }),
      );
    });

    it('should handle empty records array', async () => {
      const emptyStateData = {
        state: 'NV',
        metrics: {
          totalCensusBlocks: 0,
          blocksWithBroadband: 0,
          broadbandAvailabilityPercent: 0,
          blocksWithHighSpeed: 0,
          highSpeedAvailabilityPercent: 0,
          blocksWithGigabit: 0,
          gigabitAvailabilityPercent: 0,
          technologyCounts: {
            fiber: 0,
            cable: 0,
            dsl: 0,
            wireless: 0,
            other: 0,
          },
          averageDownloadSpeed: 0,
          medianDownloadSpeed: 0,
          broadbandScore: 0,
        },
        dataVersion: 'test-version-3.0',
        lastUpdated: new Date(),
      };

      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(emptyStateData);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'NV',
          totalCensusBlocks: 0,
          blocksWithBroadband: 0,
          broadbandAvailabilityPercent: 0,
          broadbandScore: 0,
        }),
      );
    });

    it('should log processing progress correctly', async () => {
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(mockStateData);

      expect(logger.info).toHaveBeenCalledWith(
        'Starting to process CA with pre-calculated metrics (S3 version: test-version-1.0)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Will process CA with 2 total blocks (version: test-version-1.0)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'About to save broadband record for CA to DynamoDB',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully saved broadband record for CA to DynamoDB',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully saved metadata record for CA to DynamoDB',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully processed aggregated metrics for CA (version: test-version-1.0)',
        expect.objectContaining({
          totalBlocks: 2,
          availabilityPercent: 100,
          score: expect.any(Number),
        }),
      );
    });

    it('should handle shouldProcessStateData errors gracefully', async () => {
      const mockError = new Error('Version check failed');
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockRejectedValue(mockError);

      await (service as any).processStateData(mockStateData);

      expect(logger.error).toHaveBeenCalledWith(
        'Error processing state data for CA:',
        mockError,
      );
    });

    it('should create correct broadband record structure', async () => {
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(mockStateData);

      const savedRecord = mockRepository.save.mock.calls[0][0];
      expect(savedRecord).toMatchObject({
        state: 'CA',
        timestamp: expect.any(Number),
        dataVersion: 'test-version-1.0',
        totalCensusBlocks: 2,
        blocksWithBroadband: 2,
        broadbandAvailabilityPercent: 100,
        blocksWithHighSpeed: 2,
        highSpeedAvailabilityPercent: 100,
        blocksWithGigabit: 1,
        gigabitAvailabilityPercent: 50,
        technologyCounts: {
          fiber: 1,
          cable: 1,
          dsl: 0,
          wireless: 0,
          other: 0,
        },
        averageDownloadSpeed: 800,
        medianDownloadSpeed: 800,
        broadbandScore: expect.any(Number),
      });
    });

    it('should create correct metadata record structure', async () => {
      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(mockStateData);

      const savedMetadata =
        mockRepository.saveStateVersionMetadata.mock.calls[0][0];
      expect(savedMetadata).toMatchObject({
        state: 'CA',
        dataVersion: 'test-version-1.0',
        lastProcessed: expect.any(Number),
      });
    });

    it('should handle technology mapping edge cases', async () => {
      const edgeCaseStateData = {
        state: 'AK',
        metrics: {
          totalCensusBlocks: 1,
          blocksWithBroadband: 1,
          broadbandAvailabilityPercent: 100,
          blocksWithHighSpeed: 1,
          highSpeedAvailabilityPercent: 100,
          blocksWithGigabit: 1,
          gigabitAvailabilityPercent: 100,
          technologyCounts: {
            fiber: 1,
            cable: 0,
            dsl: 0,
            wireless: 0,
            other: 1,
          },
          averageDownloadSpeed: 10,
          medianDownloadSpeed: 10,
          broadbandScore: 1,
        },
        dataVersion: 'test-version-edge',
        lastUpdated: new Date(),
      };

      jest
        .spyOn(service as any, 'shouldProcessStateData')
        .mockResolvedValue(true);

      await (service as any).processStateData(edgeCaseStateData);

      const savedRecord = mockRepository.save.mock.calls[0][0];
      expect(savedRecord.technologyCounts.other).toBe(1);
    });
  });

  describe('processStateCallback', () => {
    let mockStateData: any;
    beforeEach(() => {
      mockStateData = { state: 'CA', records: [], dataVersion: 'v1' };
      jest.clearAllMocks();
    });

    it('should log and call processStateData for a state', async () => {
      const processStateDataSpy = jest
        .spyOn(service as any, 'processStateData')
        .mockResolvedValue(undefined);

      await (service as any).processStateCallback(mockStateData);

      expect(logger.info).toHaveBeenCalledWith('About to process state: CA');
      expect(processStateDataSpy).toHaveBeenCalledWith(mockStateData);
      expect(logger.info).toHaveBeenCalledWith('Finished processing state: CA');
    });

    it('should propagate errors from processStateData', async () => {
      const error = new Error('processStateData failed');
      jest.spyOn(service as any, 'processStateData').mockRejectedValue(error);

      await expect(
        (service as any).processStateCallback(mockStateData),
      ).rejects.toThrow('processStateData failed');
    });
  });

  describe('isVersionNewer', () => {
    it('should return true when new version is greater than existing version', () => {
      const result = (service as any).isVersionNewer('v2.0', 'v1.0');
      expect(result).toBe(true);
    });

    it('should return false when new version is less than existing version', () => {
      const result = (service as any).isVersionNewer('v1.0', 'v2.0');
      expect(result).toBe(false);
    });

    it('should return false when versions are equal', () => {
      const result = (service as any).isVersionNewer('v1.0', 'v1.0');
      expect(result).toBe(false);
    });

    it('should handle semantic versioning correctly', () => {
      expect((service as any).isVersionNewer('2.1.0', '2.0.0')).toBe(true);
      expect((service as any).isVersionNewer('2.0.1', '2.0.0')).toBe(true);
      expect((service as any).isVersionNewer('2.0.0', '2.0.1')).toBe(false);
    });

    it('should handle string comparison for non-semantic versions', () => {
      expect((service as any).isVersionNewer('Dec2021-v2', 'Dec2021-v1')).toBe(
        true,
      );
      expect((service as any).isVersionNewer('Dec2021-v1', 'Dec2021-v2')).toBe(
        false,
      );
    });
  });

  describe('getAllScores', () => {
    let mockRepository: any;

    beforeEach(() => {
      mockRepository = {
        getAllScores: jest.fn(),
      };
      (service as any).repository = mockRepository;
    });

    it('should return scores from repository successfully', async () => {
      const mockScores = {
        CA: 0.8765,
        TX: 0.7234,
        NY: 0.9123,
      };
      mockRepository.getAllScores.mockResolvedValue(mockScores);

      const result = await service.getAllScores();

      expect(result).toEqual(mockScores);
      expect(mockRepository.getAllScores).toHaveBeenCalledTimes(1);
    });

    it('should handle repository errors gracefully', async () => {
      const mockError = new Error('Repository error');
      mockRepository.getAllScores.mockRejectedValue(mockError);

      const result = await service.getAllScores();

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting broadband scores:',
        mockError,
      );
    });

    it('should handle unknown error types', async () => {
      const mockError = 'String error';
      mockRepository.getAllScores.mockRejectedValue(mockError);

      const result = await service.getAllScores();

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting broadband scores:',
        mockError,
      );
    });

    it('should return empty object when repository returns empty scores', async () => {
      mockRepository.getAllScores.mockResolvedValue({});

      const result = await service.getAllScores();

      expect(result).toEqual({});
    });
  });

  describe('shouldProcessStateData', () => {
    let mockRepository: any;

    beforeEach(() => {
      mockRepository = {
        getByStateAndVersion: jest.fn(),
      };
      (service as any).repository = mockRepository;
    });

    it('should return false when existing record is found', async () => {
      const existingRecord = {
        state: 'CA',
        dataVersion: 'Dec2021-v1',
        broadbandScore: 0.8765,
      };
      mockRepository.getByStateAndVersion.mockResolvedValue(existingRecord);

      const result = await (service as any).shouldProcessStateData(
        'CA',
        'Dec2021-v1',
      );
      expect(result).toBe(false);
      expect(mockRepository.getByStateAndVersion).toHaveBeenCalledWith(
        'CA',
        'Dec2021-v1',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Version check for CA: S3 version=Dec2021-v1, existing record=YES',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'State CA version Dec2021-v1 already exists in DynamoDB, skipping',
      );
    });

    it('should return true when no existing record is found', async () => {
      mockRepository.getByStateAndVersion.mockResolvedValue(null);

      const result = await (service as any).shouldProcessStateData(
        'TX',
        'Dec2021-v2',
      );
      expect(result).toBe(true);
      expect(mockRepository.getByStateAndVersion).toHaveBeenCalledWith(
        'TX',
        'Dec2021-v2',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Version check for TX: S3 version=Dec2021-v2, existing record=NO',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'State TX version Dec2021-v2 not found in DynamoDB, will process',
      );
    });

    it('should return true when repository returns undefined', async () => {
      mockRepository.getByStateAndVersion.mockResolvedValue(undefined);

      const result = await (service as any).shouldProcessStateData(
        'NY',
        'Dec2021-v3',
      );
      expect(result).toBe(true);
      expect(mockRepository.getByStateAndVersion).toHaveBeenCalledWith(
        'NY',
        'Dec2021-v3',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Version check for NY: S3 version=Dec2021-v3, existing record=NO',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'State NY version Dec2021-v3 not found in DynamoDB, will process',
      );
    });

    it('should handle repository errors gracefully and return true', async () => {
      const mockError = new Error('DynamoDB query failed');
      mockRepository.getByStateAndVersion.mockRejectedValue(mockError);

      const result = await (service as any).shouldProcessStateData(
        'FL',
        'Dec2021-v1',
      );
      expect(result).toBe(true);
      expect(mockRepository.getByStateAndVersion).toHaveBeenCalledWith(
        'FL',
        'Dec2021-v1',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking version for FL:',
        mockError,
      );
    });

    it('should handle unknown error types and return true', async () => {
      const mockError = 'String error';
      mockRepository.getByStateAndVersion.mockRejectedValue(mockError);

      const result = await (service as any).shouldProcessStateData(
        'WA',
        'Dec2021-v1',
      );
      expect(result).toBe(true);
      expect(mockRepository.getByStateAndVersion).toHaveBeenCalledWith(
        'WA',
        'Dec2021-v1',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking version for WA:',
        mockError,
      );
    });

    it('should handle repository timeout errors and return true', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockRepository.getByStateAndVersion.mockRejectedValue(timeoutError);

      const result = await (service as any).shouldProcessStateData(
        'OR',
        'Dec2021-v1',
      );
      expect(result).toBe(true);
      expect(mockRepository.getByStateAndVersion).toHaveBeenCalledWith(
        'OR',
        'Dec2021-v1',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking version for OR:',
        timeoutError,
      );
    });
  });
});
