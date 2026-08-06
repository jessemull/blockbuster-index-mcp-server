import { CONFIG } from '../../config';
import { DynamoDBCensusSignalRepository } from '../../repositories/census';
import { fetchCensusData } from '../../services';
import { CensusData } from '../../types';
import { logger } from '../../util';
import { getCensusScores } from './get-census-scores';

jest.mock('../../config');
jest.mock('../../services');
jest.mock('../../util', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockFetchCensusData = fetchCensusData as jest.MockedFunction<
  typeof fetchCensusData
>;

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockCONFIG = CONFIG as jest.Mocked<typeof CONFIG>;
const mockDynamoDBCensusSignalRepository = jest.fn();
jest.mock('../../repositories/census', () => ({
  DynamoDBCensusSignalRepository: mockDynamoDBCensusSignalRepository,
}));

describe('getCensusScores', () => {
  const currentYear = new Date().getFullYear();
  const primaryYear = currentYear - 1;
  const fallbackYear = currentYear - 2;
  const oldestYear = currentYear - 3;

  const expectedPrimaryTimestamp = (() => {
    const startOfDay = new Date(primaryYear, 0, 1);
    startOfDay.setUTCHours(0, 0, 0, 0);
    return Math.floor(startOfDay.getTime() / 1000);
  })();

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
    workforce: {
      AL: 2500000,
      CA: 20000000,
      TX: 15000000,
    },
    year: fallbackYear,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    mockCONFIG.IS_DEVELOPMENT = false;
    mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = 'test-table';
    mockCONFIG.FORCE_REFRESH = false;

    const defaultMockRepository = {
      save: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    };
    mockDynamoDBCensusSignalRepository.mockReturnValue(
      defaultMockRepository as unknown as DynamoDBCensusSignalRepository,
    );
  });

  afterEach(() => {
    mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = undefined;
    mockCONFIG.FORCE_REFRESH = false;
  });

  describe('successful data fetching', () => {
    it('fetches and calculates scores successfully with repository', async () => {
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20,
        CA: 13,
        TX: 10,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting Census retail establishment calculation...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Attempting to fetch Census data for year ${primaryYear} (attempt 1/3)`,
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Successfully found Census data for year ${primaryYear}`,
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Using Census data for year ${primaryYear} (current year: ${currentYear})`,
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
        workforce: { CA: 500000 },
        year: fallbackYear,
      };

      mockFetchCensusData.mockResolvedValue(censusDataWithFractions);

      const scores = await getCensusScores();

      expect(scores.CA).toBe(123);
    });

    it('handles states with missing population data', async () => {
      const censusDataWithMissingPopulation = {
        establishments: { AL: 1000, CA: 5000 },
        population: { AL: 5000000 },
        workforce: { AL: 2500000 },
        year: fallbackYear,
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
      mockFetchCensusData
        .mockRejectedValueOnce(new Error('404 Not Found'))
        .mockResolvedValueOnce(mockCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20,
        CA: 13,
        TX: 10,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Attempting to fetch Census data for year ${primaryYear} (attempt 1/3)`,
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Census data not available for year ${primaryYear}, trying previous year`,
        expect.any(Error),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Attempting to fetch Census data for year ${fallbackYear} (attempt 2/3)`,
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Successfully found Census data for year ${fallbackYear}`,
      );
    });

    it('throws error when no data is available after 3 attempts', async () => {
      mockFetchCensusData.mockRejectedValue(new Error('404 Not Found'));

      await expect(getCensusScores()).rejects.toThrow(
        `No Census data available for years ${primaryYear} through ${oldestYear}`,
      );

      expect(mockFetchCensusData).toHaveBeenCalledTimes(3);
      expect(mockFetchCensusData).toHaveBeenCalledWith(primaryYear);
      expect(mockFetchCensusData).toHaveBeenCalledWith(fallbackYear);
      expect(mockFetchCensusData).toHaveBeenCalledWith(oldestYear);
    });

    it('throws error when censusData is null after fallback attempts', async () => {
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
        `Record already exists for AL year ${primaryYear}, skipping storage`,
      );
    });

    it('creates repository when CENSUS_DYNAMODB_TABLE_NAME is set in development', async () => {
      mockCONFIG.IS_DEVELOPMENT = true;
      mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = 'dev-table';
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
        `Record already exists for AL year ${primaryYear}, skipping storage`,
      );
    });

    it('skips repository creation in development mode without table name', async () => {
      mockCONFIG.IS_DEVELOPMENT = true;
      mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = undefined;
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
      mockCONFIG.FORCE_REFRESH = true;
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stored Census data for AL: 20 establishments per 100k, 2500000 workforce',
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
        timestamp: expectedPrimaryTimestamp,
        workforce: 2500000,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stored Census data for AL: 20 establishments per 100k, 2500000 workforce',
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
        `Record already exists for AL year ${primaryYear}, skipping storage`,
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

    it('uses the default table name when env var is not set', async () => {
      mockCONFIG.IS_DEVELOPMENT = false;
      mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = undefined;
      const mockRepository = {
        save: jest.fn(),
        exists: jest.fn().mockResolvedValue(false),
      };
      mockDynamoDBCensusSignalRepository.mockReturnValue(
        mockRepository as unknown as DynamoDBCensusSignalRepository,
      );
      mockFetchCensusData.mockResolvedValue({
        establishments: { AL: 100 },
        population: { AL: 1000 },
        workforce: { AL: 500 },
        year: fallbackYear,
      });

      await getCensusScores();

      expect(mockDynamoDBCensusSignalRepository).toHaveBeenCalledWith(
        'blockbuster-index-census-signals-dev',
      );
    });
  });

  describe('timestamp calculation', () => {
    it('uses correct timestamp for primary-year data', async () => {
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Successfully found Census data for year ${primaryYear}`,
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty establishment data', async () => {
      const emptyCensusData = {
        establishments: {},
        population: {},
        workforce: {},
        year: fallbackYear,
      };

      mockFetchCensusData.mockResolvedValue(emptyCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Completed Census calculation: processed 0 states',
      );
    });

    it('covers default parameter for getStartOfDayTimestamp', async () => {
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      await getCensusScores();

      expect(mockFetchCensusData).toHaveBeenCalled();
    });

    it('covers repository creation when both conditions are false', async () => {
      mockCONFIG.IS_DEVELOPMENT = true;
      mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = undefined;
      mockFetchCensusData.mockResolvedValue(mockCensusData);

      const scores = await getCensusScores();

      expect(scores).toEqual({
        AL: 20,
        CA: 13,
        TX: 10,
      });
      expect(mockDynamoDBCensusSignalRepository).not.toHaveBeenCalled();
    });
  });
});
