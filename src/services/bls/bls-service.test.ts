import { BlsService } from './bls-service';
import { DynamoDBBlsRepository } from '../../repositories/bls/bls-repository';
import { S3BlsLoader } from './s3-bls-loader';
import { logger } from '../../util';
import {
  detectAndCorrectOutliers,
  logOutlierAnalysis,
} from '../../util/helpers';
import { BlsSignalRecord } from '../../types/bls';

jest.mock('../../repositories/bls/bls-repository');
jest.mock('./s3-bls-loader');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('../../util/helpers', () => ({
  detectAndCorrectOutliers: jest.fn(),
  logOutlierAnalysis: jest.fn(),
}));

const mockDynamoDBBlsRepository = DynamoDBBlsRepository as jest.MockedClass<
  typeof DynamoDBBlsRepository
>;
const mockS3BlsLoader = S3BlsLoader as jest.MockedClass<typeof S3BlsLoader>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockDetectAndCorrectOutliers =
  detectAndCorrectOutliers as jest.MockedFunction<
    typeof detectAndCorrectOutliers
  >;
const mockLogOutlierAnalysis = logOutlierAnalysis as jest.MockedFunction<
  typeof logOutlierAnalysis
>;

describe('BlsService', () => {
  let blsService: BlsService;
  let mockRepository: jest.Mocked<DynamoDBBlsRepository>;
  let mockS3Loader: jest.Mocked<S3BlsLoader>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      isFileProcessed: jest.fn(),
      saveStateDataBatch: jest.fn(),
      saveProcessedFile: jest.fn(),
      getAllUniqueStates: jest.fn(),
      getAllStateDataForState: jest.fn(),
      saveSignal: jest.fn(),
      getAllSignals: jest.fn(),
    } as any;

    mockS3Loader = {
      listAvailableYears: jest.fn(),
      getFileSize: jest.fn(),
      processCsvInChunks: jest.fn(),
    } as any;

    mockDynamoDBBlsRepository.mockImplementation(() => mockRepository);
    mockS3BlsLoader.mockImplementation(() => mockS3Loader);

    blsService = new BlsService(mockRepository);
  });

  describe('constructor', () => {
    it('should create BlsService with default repository when not provided', () => {
      const service = new BlsService();
      expect(service).toBeInstanceOf(BlsService);
      expect(mockDynamoDBBlsRepository).toHaveBeenCalledWith(
        'blockbuster-index-bls-processed-files-dev',
        'blockbuster-index-bls-state-data-dev',
        'blockbuster-index-bls-signals-dev',
      );
    });

    it('should create BlsService with provided repository', () => {
      const customRepository = {} as DynamoDBBlsRepository;
      const service = new BlsService(customRepository);
      expect(service).toBeInstanceOf(BlsService);
    });

    it('should use environment variables for table names', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        BLS_PROCESSED_FILES_TABLE_NAME: 'custom-processed-files',
        BLS_STATE_DATA_TABLE_NAME: 'custom-state-data',
        BLS_SIGNALS_TABLE_NAME: 'custom-signals',
        BLS_S3_BUCKET: 'custom-bucket',
      };

      new BlsService();

      expect(mockDynamoDBBlsRepository).toHaveBeenCalledWith(
        'custom-processed-files',
        'custom-state-data',
        'custom-signals',
      );

      process.env = originalEnv;
    });
  });

  describe('processBlsData', () => {
    it('should process BLS data successfully', async () => {
      const mockYears = ['2020', '2021'];
      mockS3Loader.listAvailableYears.mockResolvedValue(mockYears);
      mockS3Loader.getFileSize.mockResolvedValue(1024);
      mockS3Loader.processCsvInChunks.mockReturnValue(
        (async function* () {
          yield [
            {
              area_fips: '06000',
              own_code: '5',
              industry_code: '442110',
              agglvl_code: '70',
              size_code: '001',
              year: '2020',
              annual_avg_emplvl: '1000',
              annual_avg_estabs: '50',
              total_annual_wages: '50000000',
              taxable_annual_wages: '45000000',
              annual_contributions: '1000000',
              annual_avg_wkly_wage: '1000',
              avg_annual_pay: '52000',
              lq_annual_avg_emplvl: '1.5',
              lq_annual_avg_estabs: '1.2',
              lq_total_annual_wages: '1.3',
              lq_taxable_annual_wages: '1.4',
              lq_annual_contributions: '1.1',
              lq_annual_avg_wkly_wage: '1.6',
              lq_avg_annual_pay: '1.7',
              oty_total_annual_wages_pct: '5.2',
              oty_annual_avg_emplvl_pct: '3.1',
              oty_annual_avg_estabs_pct: '2.8',
            },
          ];
        })(),
      );

      mockRepository.isFileProcessed.mockResolvedValue(false);
      mockRepository.saveStateDataBatch.mockResolvedValue();
      mockRepository.saveProcessedFile.mockResolvedValue();
      mockRepository.getAllUniqueStates.mockResolvedValue(['CA']);
      mockRepository.getAllStateDataForState.mockResolvedValue([
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 2.0 },
        },
        {
          state: 'CA',
          year: 2021,
          timestamp: 1234567890,
          brickAndMortarCodes: { '442110': 1.6 },
          ecommerceCodes: { '454110': 2.1 },
        },
      ]);
      mockRepository.saveSignal.mockResolvedValue();

      await blsService.processBlsData();

      expect(mockS3Loader.listAvailableYears).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting BLS data processing from S3...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'BLS data processing completed',
      );
    });

    it('should handle errors during processing', async () => {
      const mockError = new Error('Processing error');
      mockS3Loader.listAvailableYears.mockRejectedValue(mockError);

      await expect(blsService.processBlsData()).rejects.toThrow(
        'Processing error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in BLS data processing:',
        mockError,
      );
    });

    it('should skip already processed years', async () => {
      const mockYears = ['2020'];
      mockS3Loader.listAvailableYears.mockResolvedValue(mockYears);
      mockRepository.isFileProcessed.mockResolvedValue(true);
      mockRepository.getAllUniqueStates.mockResolvedValue([]);

      await blsService.processBlsData();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Year 2020 already processed, skipping',
      );
    });

    it('should handle empty states list', async () => {
      const mockYears = ['2020'];
      mockS3Loader.listAvailableYears.mockResolvedValue(mockYears);
      mockS3Loader.getFileSize.mockResolvedValue(1024);
      mockS3Loader.processCsvInChunks.mockReturnValue(
        (async function* () {
          yield [];
        })(),
      );

      mockRepository.isFileProcessed.mockResolvedValue(false);
      mockRepository.saveStateDataBatch.mockResolvedValue();
      mockRepository.saveProcessedFile.mockResolvedValue();
      mockRepository.getAllUniqueStates.mockResolvedValue([]);

      await blsService.processBlsData();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No states found for signal calculation',
      );
    });
  });

  describe('getAllPhysicalScores', () => {
    it('should return physical scores with outlier detection', async () => {
      const mockSignals: BlsSignalRecord[] = [
        {
          state: 'CA',
          timestamp: 1234567890,
          calculatedAt: '2023-01-01T00:00:00Z',
          physicalSlope: 0.1,
          physicalTrend: 'growing',
          ecommerceSlope: 0.2,
          ecommerceTrend: 'growing',
          physicalScore: 75.5,
          ecommerceScore: 80.0,
          dataPoints: 10,
          yearsAnalyzed: [2020, 2021],
        },
        {
          state: 'TX',
          timestamp: 1234567890,
          calculatedAt: '2023-01-01T00:00:00Z',
          physicalSlope: -0.1,
          physicalTrend: 'declining',
          ecommerceSlope: 0.1,
          ecommerceTrend: 'growing',
          physicalScore: 25.5,
          ecommerceScore: 60.0,
          dataPoints: 8,
          yearsAnalyzed: [2020, 2021],
        },
      ];

      const mockOutlierAnalysis = {
        outliers: ['TX'],
        correctedScores: { CA: 75.5, TX: 50.0 },
        median: 50.0,
        mean: 50.5,
        standardDeviation: 25.0,
      };

      mockRepository.getAllSignals.mockResolvedValue(mockSignals);
      mockDetectAndCorrectOutliers.mockReturnValue(mockOutlierAnalysis);

      const result = await blsService.getAllPhysicalScores();

      expect(result).toEqual({ CA: 75.5, TX: 50.0 });
      expect(mockDetectAndCorrectOutliers).toHaveBeenCalledWith({
        CA: 75.5,
        TX: 25.5,
      });
      expect(mockLogOutlierAnalysis).toHaveBeenCalledWith(
        mockOutlierAnalysis,
        'physical',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Corrected 1 physical score outliers: TX',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved physical scores for 2 states',
      );
    });

    it('should handle repository errors', async () => {
      const mockError = new Error('Repository error');
      mockRepository.getAllSignals.mockRejectedValue(mockError);

      await expect(blsService.getAllPhysicalScores()).rejects.toThrow(
        'Repository error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting physical scores:',
        mockError,
      );
    });

    it('should handle empty signals', async () => {
      mockRepository.getAllSignals.mockResolvedValue([]);
      mockDetectAndCorrectOutliers.mockReturnValue({
        outliers: [],
        correctedScores: {},
        median: 0,
        mean: 0,
        standardDeviation: 0,
      });

      const result = await blsService.getAllPhysicalScores();

      expect(result).toEqual({});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved physical scores for 0 states',
      );
    });
  });

  describe('getAllEcommerceScores', () => {
    it('should return ecommerce scores without outlier detection', async () => {
      const mockSignals: BlsSignalRecord[] = [
        {
          state: 'CA',
          timestamp: 1234567890,
          calculatedAt: '2023-01-01T00:00:00Z',
          physicalSlope: 0.1,
          physicalTrend: 'growing',
          ecommerceSlope: 0.2,
          ecommerceTrend: 'growing',
          physicalScore: 75.5,
          ecommerceScore: 80.0,
          dataPoints: 10,
          yearsAnalyzed: [2020, 2021],
        },
        {
          state: 'TX',
          timestamp: 1234567890,
          calculatedAt: '2023-01-01T00:00:00Z',
          physicalSlope: -0.1,
          physicalTrend: 'declining',
          ecommerceSlope: 0.1,
          ecommerceTrend: 'growing',
          physicalScore: 25.5,
          ecommerceScore: 60.0,
          dataPoints: 8,
          yearsAnalyzed: [2020, 2021],
        },
      ];

      mockRepository.getAllSignals.mockResolvedValue(mockSignals);

      const result = await blsService.getAllEcommerceScores();

      expect(result).toEqual({ CA: 80.0, TX: 60.0 });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved ecommerce scores for 2 states',
      );
    });

    it('should handle repository errors', async () => {
      const mockError = new Error('Repository error');
      mockRepository.getAllSignals.mockRejectedValue(mockError);

      await expect(blsService.getAllEcommerceScores()).rejects.toThrow(
        'Repository error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting ecommerce scores:',
        mockError,
      );
    });

    it('should handle empty signals', async () => {
      mockRepository.getAllSignals.mockResolvedValue([]);

      const result = await blsService.getAllEcommerceScores();

      expect(result).toEqual({});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved ecommerce scores for 0 states',
      );
    });
  });

  describe('processYearData', () => {
    it('should process year data successfully', async () => {
      const year = '2020';
      mockRepository.isFileProcessed.mockResolvedValue(false);
      mockS3Loader.getFileSize.mockResolvedValue(1024);
      mockS3Loader.processCsvInChunks.mockReturnValue(
        (async function* () {
          yield [
            {
              area_fips: '06000',
              own_code: '5',
              industry_code: '442110',
              agglvl_code: '70',
              size_code: '001',
              year: '2020',
              annual_avg_emplvl: '1000',
              annual_avg_estabs: '50',
              total_annual_wages: '50000000',
              taxable_annual_wages: '45000000',
              annual_contributions: '1000000',
              annual_avg_wkly_wage: '1000',
              avg_annual_pay: '52000',
              lq_annual_avg_emplvl: '1.5',
              lq_annual_avg_estabs: '1.2',
              lq_total_annual_wages: '1.3',
              lq_taxable_annual_wages: '1.4',
              lq_annual_contributions: '1.1',
              lq_annual_avg_wkly_wage: '1.6',
              lq_avg_annual_pay: '1.7',
              oty_total_annual_wages_pct: '5.2',
              oty_annual_avg_emplvl_pct: '3.1',
              oty_annual_avg_estabs_pct: '2.8',
            },
          ];
        })(),
      );

      mockRepository.saveStateDataBatch.mockResolvedValue();
      mockRepository.saveProcessedFile.mockResolvedValue();

      await (blsService as any).processYearData(year);

      expect(mockRepository.isFileProcessed).toHaveBeenCalledWith(year);
      expect(mockS3Loader.getFileSize).toHaveBeenCalledWith(year);
      expect(mockS3Loader.processCsvInChunks).toHaveBeenCalledWith(year, 10000);
      expect(mockRepository.saveStateDataBatch).toHaveBeenCalled();
      expect(mockRepository.saveProcessedFile).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully processed year 2020: 1 valid state records',
      );
    });

    it('should skip already processed years', async () => {
      const year = '2020';
      mockRepository.isFileProcessed.mockResolvedValue(true);

      await (blsService as any).processYearData(year);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Year 2020 already processed, skipping',
      );
      expect(mockS3Loader.getFileSize).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      const year = '2020';
      const mockError = new Error('Processing error');
      mockRepository.isFileProcessed.mockRejectedValue(mockError);

      await expect((blsService as any).processYearData(year)).rejects.toThrow(
        'Processing error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process year 2020:',
        mockError,
      );
    });

    it('should handle large files with progress logging', async () => {
      const year = '2020';
      mockRepository.isFileProcessed.mockResolvedValue(false);
      mockS3Loader.getFileSize.mockResolvedValue(200 * 1024 * 1024); // 200MB
      mockS3Loader.processCsvInChunks.mockReturnValue(
        (async function* () {
          yield [
            {
              area_fips: '06000',
              own_code: '5',
              industry_code: '442110',
              agglvl_code: '70',
              size_code: '001',
              year: '2020',
              annual_avg_emplvl: '1000',
              annual_avg_estabs: '50',
              total_annual_wages: '50000000',
              taxable_annual_wages: '45000000',
              annual_contributions: '1000000',
              annual_avg_wkly_wage: '1000',
              avg_annual_pay: '52000',
              lq_annual_avg_emplvl: '1.5',
              lq_annual_avg_estabs: '1.2',
              lq_total_annual_wages: '1.3',
              lq_taxable_annual_wages: '1.4',
              lq_annual_contributions: '1.1',
              lq_annual_avg_wkly_wage: '1.6',
              lq_avg_annual_pay: '1.7',
              oty_total_annual_wages_pct: '5.2',
              oty_annual_avg_emplvl_pct: '3.1',
              oty_annual_avg_estabs_pct: '2.8',
            },
          ];
        })(),
      );

      mockRepository.saveStateDataBatch.mockResolvedValue();
      mockRepository.saveProcessedFile.mockResolvedValue();

      await (blsService as any).processYearData(year);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processed 1 records for year 2020 (1 states so far)',
      );
    });
  });

  describe('calculateAllSignals', () => {
    it('should calculate signals for all states', async () => {
      const mockStates = ['CA', 'TX'];
      mockRepository.getAllUniqueStates.mockResolvedValue(mockStates);
      mockRepository.getAllStateDataForState
        .mockResolvedValueOnce([
          {
            state: 'CA',
            year: 2020,
            timestamp: 1234567890,
            brickAndMortarCodes: { '442110': 1.5 },
            ecommerceCodes: { '454110': 2.0 },
          },
          {
            state: 'CA',
            year: 2021,
            timestamp: 1234567890,
            brickAndMortarCodes: { '442110': 1.6 },
            ecommerceCodes: { '454110': 2.1 },
          },
        ])
        .mockResolvedValueOnce([
          {
            state: 'TX',
            year: 2020,
            timestamp: 1234567890,
            brickAndMortarCodes: { '442110': 1.2 },
            ecommerceCodes: { '454110': 1.8 },
          },
          {
            state: 'TX',
            year: 2021,
            timestamp: 1234567890,
            brickAndMortarCodes: { '442110': 1.3 },
            ecommerceCodes: { '454110': 1.9 },
          },
        ]);

      mockRepository.saveSignal.mockResolvedValue();

      await (blsService as any).calculateAllSignals();

      expect(mockRepository.getAllUniqueStates).toHaveBeenCalled();
      expect(mockRepository.saveSignal).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Calculating BLS signals for all states...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Calculated signals for 2 states',
      );
    });

    it('should handle empty states list', async () => {
      mockRepository.getAllUniqueStates.mockResolvedValue([]);

      await (blsService as any).calculateAllSignals();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No states found for signal calculation',
      );
    });

    it('should handle states with no data', async () => {
      const mockStates = ['CA'];
      mockRepository.getAllUniqueStates.mockResolvedValue(mockStates);
      mockRepository.getAllStateDataForState.mockResolvedValue([]);

      await (blsService as any).calculateAllSignals();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No state data found for CA',
      );
      expect(mockRepository.saveSignal).not.toHaveBeenCalled();
    });

    it('should handle calculation errors for individual states', async () => {
      const mockStates = ['CA'];
      mockRepository.getAllUniqueStates.mockResolvedValue(mockStates);
      mockRepository.getAllStateDataForState.mockRejectedValue(
        new Error('State error'),
      );

      await (blsService as any).calculateAllSignals();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error calculating signal for state CA:',
        expect.any(Error),
      );
      expect(mockRepository.saveSignal).not.toHaveBeenCalled();
    });

    it('should handle signal saving errors', async () => {
      const mockStates = ['CA'];
      mockRepository.getAllUniqueStates.mockResolvedValue(mockStates);
      mockRepository.getAllStateDataForState.mockResolvedValue([
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 2.0 },
        },
        {
          state: 'CA',
          year: 2021,
          timestamp: 1234567890,
          brickAndMortarCodes: { '442110': 1.6 },
          ecommerceCodes: { '454110': 2.1 },
        },
      ]);
      mockRepository.saveSignal.mockRejectedValue(new Error('Save error'));

      await (blsService as any).calculateAllSignals();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error saving signal for CA:',
        expect.any(Error),
      );
    });

    it('should handle calculation errors', async () => {
      const mockError = new Error('Calculation error');
      mockRepository.getAllUniqueStates.mockRejectedValue(mockError);

      await expect((blsService as any).calculateAllSignals()).rejects.toThrow(
        'Calculation error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error calculating all signals:',
        mockError,
      );
    });

    it('should process multiple batches with delay', async () => {
      const mockStates = [
        'CA',
        'TX',
        'NY',
        'FL',
        'WA',
        'OR',
        'NV',
        'AZ',
        'CO',
        'UT',
      ];
      mockRepository.getAllUniqueStates.mockResolvedValue(mockStates);

      const mockStateData = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 2.0 },
        },
        {
          state: 'CA',
          year: 2021,
          timestamp: 1234567890,
          brickAndMortarCodes: { '442110': 1.6 },
          ecommerceCodes: { '454110': 2.1 },
        },
      ];

      mockRepository.getAllStateDataForState.mockResolvedValue(mockStateData);
      mockRepository.saveSignal.mockResolvedValue();

      await (blsService as any).calculateAllSignals();

      expect(mockRepository.getAllUniqueStates).toHaveBeenCalled();
      expect(mockRepository.saveSignal).toHaveBeenCalledTimes(10);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Calculating BLS signals for all states...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Calculated signals for 10 states',
      );
    });
  });
});
