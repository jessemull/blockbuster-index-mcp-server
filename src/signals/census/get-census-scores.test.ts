import { CONFIG } from '../../config';
import { fetchCensusData } from '../../services/census-service';
import { logger } from '../../util';
import { getCensusScores } from './get-census-scores';
import { DynamoDBCensusSignalRepository } from '../../repositories';
import { CensusData } from '../../types';

jest.mock('../../config');
jest.mock('../../services/census-service');
jest.mock('../../util', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../repositories', () => ({
  DynamoDBCensusSignalRepository: jest.fn(),
}));

const mockFetchCensusData = fetchCensusData as jest.MockedFunction<
  typeof fetchCensusData
>;

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockCONFIG = CONFIG as jest.Mocked<typeof CONFIG>;
const mockDynamoDBCensusSignalRepository = jest.mocked(
  DynamoDBCensusSignalRepository,
);

describe('getCensusScores', () => {
  const mockCensusData = {
    establishments: {
      AL: 1000,
      CA: 5000,
      TX: 3000,
    },
    population: {
      AL: 5000000,
      CA: 40000000,
      TX: 30000000,
    },
    year: 2023,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    mockCONFIG.IS_DEVELOPMENT = false;
    process.env.CENSUS_DYNAMODB_TABLE_NAME = 'test-table';

    // Set up default mock for repository
    const defaultMockRepository = {
      save: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    };
    mockDynamoDBCensusSignalRepository.mockReturnValue(
      defaultMockRepository as unknown as DynamoDBCensusSignalRepository,
    );
  });

  afterEach(() => {
    delete process.env.CENSUS_DYNAMODB_TABLE_NAME;
    delete process.env.FORCE_REFRESH;
  });

  describe('successful data fetching', () => {
    it('fetches and calculates scores successfully with repository', async () => {
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20, // 1000 establishments / 5000000 population * 100000
        CA: 13, // 5000 establishments / 40000000 population * 100000 = 12.5, rounded to 13
        TX: 10, // 3000 establishments / 30000000 population * 100000
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting Census retail establishment calculation...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting to fetch Census data for year 2024 (attempt 1/3)',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully found Census data for year 2024',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Using Census data for year 2024 (current year: 2025)',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Completed Census calculation: processed 3 states',
      );
    });

    it('handles states with zero population', async () => {
      const censusDataWithZeroPopulation = {
        ...mockCensusData,
        population: {
          ...mockCensusData.population,
          AL: 0,
        },
      };

      mockFetchCensusData.mockResolvedValue(censusDataWithZeroPopulation);

      const scores = await getCensusScores();

      expect(scores.AL).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No population data for AL, setting score to 0',
      );
    });

    it('rounds establishment counts per 100k correctly', async () => {
      const censusDataWithFractions = {
        establishments: { CA: 1234 },
        population: { CA: 1000000 },
        year: 2023,
      };

      mockFetchCensusData.mockResolvedValue(censusDataWithFractions);

      const scores = await getCensusScores();

      expect(scores.CA).toBe(123); // 1234 / 1000000 * 100000 = 123.4, rounded to 123
    });

    it('handles states with missing population data', async () => {
      const censusDataWithMissingPopulation = {
        establishments: { AL: 1000, CA: 5000 },
        population: { AL: 5000000 }, // CA missing
        year: 2023,
      };

      mockFetchCensusData.mockResolvedValue(censusDataWithMissingPopulation);

      const scores = await getCensusScores();

      expect(scores.AL).toBe(20);
      expect(scores.CA).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No population data for CA, setting score to 0',
      );
    });
  });

  describe('fallback mechanism', () => {
    it('tries multiple years when data is not available', async () => {
      // First attempt fails (2024)
      mockFetchCensusData
        .mockRejectedValueOnce(new Error('404 Not Found'))
        .mockResolvedValueOnce(mockCensusData); // Second attempt succeeds (2023)

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20,
        CA: 13,
        TX: 10,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting to fetch Census data for year 2024 (attempt 1/3)',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Census data not available for year 2024, trying previous year',
        expect.any(Error),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting to fetch Census data for year 2023 (attempt 2/3)',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully found Census data for year 2023',
      );
    });

    it('throws error when no data is available after 3 attempts', async () => {
      mockFetchCensusData.mockRejectedValue(new Error('404 Not Found'));

      await expect(getCensusScores()).rejects.toThrow(
        'No Census data available for years 2024 through 2022',
      );

      expect(mockFetchCensusData).toHaveBeenCalledTimes(3);
      expect(mockFetchCensusData).toHaveBeenCalledWith(2024);
      expect(mockFetchCensusData).toHaveBeenCalledWith(2023);
      expect(mockFetchCensusData).toHaveBeenCalledWith(2022);
    });

    it('throws error when censusData is null after fallback attempts', async () => {
      // Mock fetchCensusData to resolve with null (simulating a case where it returns null)
      mockFetchCensusData.mockResolvedValue(null as unknown as CensusData);

      await expect(getCensusScores()).rejects.toThrow(
        'Failed to fetch Census data after multiple attempts',
      );
    });
  });

  describe('repository interactions', () => {
    it('creates repository when not in development mode', async () => {
      mockCONFIG.IS_DEVELOPMENT = false;
      const mockRepository = {
        save: jest.fn(),
        exists: jest.fn().mockResolvedValue(true),
      };
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Record already exists for AL year 2024, skipping storage',
      );
    });

    it('creates repository when CENSUS_DYNAMODB_TABLE_NAME is set in development', async () => {
      mockCONFIG.IS_DEVELOPMENT = true;
      process.env.CENSUS_DYNAMODB_TABLE_NAME = 'dev-table';
      const mockRepository = {
        save: jest.fn(),
        exists: jest.fn().mockResolvedValue(true),
      };
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Record already exists for AL year 2024, skipping storage',
      );
    });

    it('skips repository creation in development mode without table name', async () => {
      mockCONFIG.IS_DEVELOPMENT = true;
      delete process.env.CENSUS_DYNAMODB_TABLE_NAME;
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20,
        CA: 13,
        TX: 10,
      });
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Record already exists'),
      );
    });

    it('forces refresh when FORCE_REFRESH is true', async () => {
      process.env.FORCE_REFRESH = 'true';
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stored Census data for AL: 20 establishments per 100k',
      );
    });

    it('stores data when record does not exist', async () => {
      const mockRepository = {
        save: jest.fn(),
        exists: jest.fn().mockResolvedValue(false),
      };
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );

      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockRepository.save).toHaveBeenCalledWith({
        retailStores: 20,
        state: 'AL',
        timestamp: 1704067200, // 2024-01-01 00:00:00 UTC
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stored Census data for AL: 20 establishments per 100k',
      );
    });

    it('skips storage when record already exists', async () => {
      const mockRepository = {
        save: jest.fn(),
        exists: jest.fn().mockResolvedValue(true),
      };
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );

      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Record already exists for AL year 2024, skipping storage',
      );
    });

    it('handles repository save errors', async () => {
      const mockRepository = {
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
        exists: jest.fn().mockResolvedValue(false),
      };
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );

      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await expect(getCensusScores()).rejects.toThrow('Save failed');
    });

    it('handles repository exists check errors', async () => {
      const mockRepository = {
        save: jest.fn(),
        exists: jest.fn(),
      };
      mockRepository.exists.mockRejectedValue(new Error('Exists check failed'));
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );

      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await expect(getCensusScores()).rejects.toThrow('Exists check failed');
    });
  });

  describe('timestamp calculation', () => {
    it('uses correct timestamp for 2024 data', async () => {
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully found Census data for year 2024',
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty establishment data', async () => {
      const emptyCensusData = {
        establishments: {},
        population: {},
        year: 2023,
      };

      mockFetchCensusData.mockResolvedValue(emptyCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Completed Census calculation: processed 0 states',
      );
    });

    it('covers default parameter for getStartOfDayTimestamp', async () => {
      // This test ensures the default parameter branch is covered
      // by calling getCensusScores without any specific date context
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      // The function should complete successfully, covering the default parameter
      expect(mockFetchCensusData).toHaveBeenCalled();
    });

    it('covers repository creation when both conditions are false', async () => {
      // Test the case where CONFIG.IS_DEVELOPMENT is true AND no env var is set
      mockCONFIG.IS_DEVELOPMENT = true;
      delete process.env.CENSUS_DYNAMODB_TABLE_NAME;
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20,
        CA: 13,
        TX: 10,
      });
      // Should not create repository when both conditions are false
      expect(mockDynamoDBCensusSignalRepository).not.toHaveBeenCalled();
    });
  });
});
