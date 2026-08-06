const mockCONFIG = {
  IS_DEVELOPMENT: false as boolean,
  CENSUS_DYNAMODB_TABLE_NAME: undefined as string | undefined,
};

const mockRepository = {
  getLatest: jest.fn(),
};

const MockRepo = jest.fn().mockImplementation(() => mockRepository);

jest.mock('../../config', () => ({
  CONFIG: mockCONFIG,
}));
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('../../repositories', () => ({
  DynamoDBCensusSignalRepository: MockRepo,
}));

import { CensusSignalRecord } from '../../types/census';
import { States } from '../../types/states';
import { getWorkforceData } from './get-workforce-data';

describe('getWorkforceData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCONFIG.IS_DEVELOPMENT = false;
    mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = undefined;
    MockRepo.mockImplementation(() => mockRepository);
  });

  it('fetches workforce data successfully from repository', async () => {
    const mockCensusRecord: CensusSignalRecord = {
      state: 'CA',
      timestamp: 1640995200,
      retailStores: 1000,
      workforce: 20000000,
    };

    mockRepository.getLatest.mockImplementation((state: string) => {
      if (state === 'CA') {
        return Promise.resolve(mockCensusRecord);
      }
      return Promise.resolve(null);
    });

    const result = await getWorkforceData();

    expect(result).toEqual({ CA: 20000000 });
  });

  it('uses custom table name when CENSUS_DYNAMODB_TABLE_NAME is set', async () => {
    mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = 'custom-census-table';

    const mockCensusRecord: CensusSignalRecord = {
      state: 'TX',
      timestamp: 1640995200,
      retailStores: 500,
      workforce: 15000000,
    };

    mockRepository.getLatest.mockImplementation((state: string) => {
      if (state === 'TX') {
        return Promise.resolve(mockCensusRecord);
      }
      return Promise.resolve(null);
    });

    const result = await getWorkforceData();

    expect(result).toEqual({ TX: 15000000 });
    expect(MockRepo).toHaveBeenCalledWith('custom-census-table');
  });

  it('fetches data for all states from the States enum', async () => {
    const mockCensusRecord: CensusSignalRecord = {
      state: 'CA',
      timestamp: 1640995200,
      retailStores: 1000,
      workforce: 20000000,
    };

    mockRepository.getLatest.mockImplementation((state: string) => {
      if (state === 'CA') {
        return Promise.resolve(mockCensusRecord);
      }
      return Promise.resolve(null);
    });

    await getWorkforceData();

    const allStates = Object.values(States);
    expect(mockRepository.getLatest).toHaveBeenCalledTimes(allStates.length);

    allStates.forEach((state) => {
      expect(mockRepository.getLatest).toHaveBeenCalledWith(state);
    });
  });

  it('only includes states with workforce data', async () => {
    const mockCensusRecordWithWorkforce: CensusSignalRecord = {
      state: 'CA',
      timestamp: 1640995200,
      retailStores: 1000,
      workforce: 20000000,
    };

    const mockCensusRecordWithoutWorkforce = {
      state: 'TX',
      timestamp: 1640995200,
      retailStores: 500,
      workforce: undefined,
    };

    mockRepository.getLatest.mockImplementation((state: string) => {
      if (state === 'CA') {
        return Promise.resolve(mockCensusRecordWithWorkforce);
      }
      if (state === 'TX') {
        return Promise.resolve(mockCensusRecordWithoutWorkforce);
      }
      return Promise.resolve(null);
    });

    const result = await getWorkforceData();

    expect(result).toEqual({ CA: 20000000 });
    expect(result).not.toHaveProperty('TX');
  });

  it('throws error when no workforce data is available for any state', async () => {
    mockRepository.getLatest.mockResolvedValue(null);

    await expect(getWorkforceData()).rejects.toThrow(
      'No workforce data available in census repository for any state',
    );
  });

  it('creates repository in development mode when table name is provided', async () => {
    mockCONFIG.IS_DEVELOPMENT = true;
    mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = 'dev-census-table';

    const mockCensusRecord: CensusSignalRecord = {
      state: 'CA',
      timestamp: 1640995200,
      retailStores: 1000,
      workforce: 20000000,
    };

    mockRepository.getLatest.mockImplementation((state: string) => {
      if (state === 'CA') {
        return Promise.resolve(mockCensusRecord);
      }
      return Promise.resolve(null);
    });

    const result = await getWorkforceData();

    expect(result).toEqual({ CA: 20000000 });
  });

  it('throws in development mode when table name is not provided', async () => {
    mockCONFIG.IS_DEVELOPMENT = true;
    mockCONFIG.CENSUS_DYNAMODB_TABLE_NAME = undefined;

    await expect(getWorkforceData()).rejects.toThrow(
      'Census repository not available in development mode',
    );
  });

  it('gets data from multiple years when available', async () => {
    const mockCensusRecord2023: CensusSignalRecord = {
      state: 'CA',
      timestamp: 1672531200,
      retailStores: 1000,
      workforce: 20000000,
    };

    const mockCensusRecord2022: CensusSignalRecord = {
      state: 'TX',
      timestamp: 1640995200,
      retailStores: 500,
      workforce: 15000000,
    };

    mockRepository.getLatest.mockImplementation((state: string) => {
      if (state === 'CA') {
        return Promise.resolve(mockCensusRecord2023);
      }
      if (state === 'TX') {
        return Promise.resolve(mockCensusRecord2022);
      }
      return Promise.resolve(null);
    });

    const result = await getWorkforceData();

    expect(result).toEqual({
      CA: 20000000,
      TX: 15000000,
    });
  });
});
