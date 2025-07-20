import { CONFIG } from '../../config';
import { CensusSignalRecord } from '../../types/census';
import { States } from '../../types/states';

jest.mock('../../config');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockCONFIG = CONFIG as jest.Mocked<typeof CONFIG>;

describe('getWorkforceData', () => {
  const mockRepository = {
    getLatest: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete process.env.CENSUS_DYNAMODB_TABLE_NAME;
  });

  it('fetches workforce data successfully from repository', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    const result = await getWorkforceData();

    expect(result).toEqual({ CA: 20000000 });
  });

  it('uses custom table name when CENSUS_DYNAMODB_TABLE_NAME is set', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;
    process.env.CENSUS_DYNAMODB_TABLE_NAME = 'custom-census-table';

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    const result = await getWorkforceData();

    expect(result).toEqual({ TX: 15000000 });
  });

  it('fetches data for all states from the States enum', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    await getWorkforceData();

    const allStates = Object.values(States);
    expect(mockRepository.getLatest).toHaveBeenCalledTimes(allStates.length);

    allStates.forEach((state) => {
      expect(mockRepository.getLatest).toHaveBeenCalledWith(state);
    });
  });

  it('only includes states with workforce data', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    const result = await getWorkforceData();

    expect(result).toEqual({ CA: 20000000 });
    expect(result).not.toHaveProperty('TX');
  });

  it('throws error when no workforce data is available for any state', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;

    mockRepository.getLatest.mockResolvedValue(null);

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');

    await expect(getWorkforceData()).rejects.toThrow(
      'No workforce data available in census repository for any state',
    );
  });

  it('creates repository in development mode when table name is provided', async () => {
    mockCONFIG.IS_DEVELOPMENT = true;
    process.env.CENSUS_DYNAMODB_TABLE_NAME = 'dev-census-table';

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    const result = await getWorkforceData();

    expect(result).toEqual({ CA: 20000000 });
  });

  it('calculates correct timestamps for different years', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    await getWorkforceData();

    expect(mockRepository.getLatest).toHaveBeenCalledWith('CA');
  });

  it('gets data from multiple years when available', async () => {
    mockCONFIG.IS_DEVELOPMENT = false;

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

    jest.doMock('../../repositories', () => ({
      DynamoDBCensusSignalRepository: jest
        .fn()
        .mockImplementation(() => mockRepository),
    }));

    const { getWorkforceData } = await import('./get-workforce-data');
    const result = await getWorkforceData();

    expect(result).toEqual({
      CA: 20000000,
      TX: 15000000,
    });
  });
});
