import { checkIfScrapingNeeded } from './check-if-scraping-needed';
import { getCurrentFccDataVersion } from './get-current-fcc-data-version';
import { logger } from '../../util/logger';
import { DynamoDBBroadbandSignalRepository } from '../../repositories';

jest.mock('./get-current-fcc-data-version', () => ({
  getCurrentFccDataVersion: jest.fn(),
}));

jest.mock('../../util/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetCurrentFccDataVersion = getCurrentFccDataVersion as jest.Mock;

const createMockRepository = (record: unknown) => ({
  get: jest.fn().mockResolvedValue(record),
});

const timestamp = Date.now();

describe('checkIfScrapingNeeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns needsScraping: true if forceRefresh is true', async () => {
    const result = await checkIfScrapingNeeded(undefined, timestamp, true);
    expect(result).toEqual({ needsScraping: true });
    expect(logger.info).toHaveBeenCalledWith(
      'Force refresh enabled, will scrape new data',
    );
  });

  it('returns needsScraping: true if repository is undefined', async () => {
    const result = await checkIfScrapingNeeded(undefined, timestamp, false);
    expect(result).toEqual({ needsScraping: true });
    expect(logger.info).toHaveBeenCalledWith(
      'No repository available, will scrape new data',
    );
  });

  it('returns needsScraping: true if no record exists', async () => {
    mockGetCurrentFccDataVersion.mockResolvedValue('Dec 21v1');
    const mockRepo = createMockRepository(null);

    const result = await checkIfScrapingNeeded(
      mockRepo as unknown as DynamoDBBroadbandSignalRepository,
      timestamp,
      false,
    );
    expect(result).toEqual({
      needsScraping: true,
      currentDataVersion: 'Dec 21v1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'No existing data found or no version info, will scrape new data',
    );
  });

  it('returns needsScraping: true if record exists but dataVersion is missing', async () => {
    mockGetCurrentFccDataVersion.mockResolvedValue('Dec 21v1');
    const mockRepo = createMockRepository({ broadbandScore: 80 });

    const result = await checkIfScrapingNeeded(
      mockRepo as unknown as DynamoDBBroadbandSignalRepository,
      timestamp,
      false,
    );
    expect(result).toEqual({
      needsScraping: true,
      currentDataVersion: 'Dec 21v1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'No existing data found or no version info, will scrape new data',
    );
  });

  it('returns needsScraping: true if versions do not match', async () => {
    mockGetCurrentFccDataVersion.mockResolvedValue('Dec 21v1');
    const mockRepo = createMockRepository({ dataVersion: 'Nov 21v1' });

    const result = await checkIfScrapingNeeded(
      mockRepo as unknown as DynamoDBBroadbandSignalRepository,
      timestamp,
      false,
    );
    expect(result).toEqual({
      needsScraping: true,
      currentDataVersion: 'Dec 21v1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Data version comparison completed',
      {
        storedVersion: 'Nov 21v1',
        currentFccVersion: 'Dec 21v1',
        needsScraping: true,
      },
    );
  });

  it('returns needsScraping: false if versions match', async () => {
    mockGetCurrentFccDataVersion.mockResolvedValue('Dec 21v1');
    const mockRepo = createMockRepository({ dataVersion: 'Dec 21v1' });

    const result = await checkIfScrapingNeeded(
      mockRepo as unknown as DynamoDBBroadbandSignalRepository,
      timestamp,
      false,
    );
    expect(result).toEqual({
      needsScraping: false,
      currentDataVersion: 'Dec 21v1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Data version comparison completed',
      {
        storedVersion: 'Dec 21v1',
        currentFccVersion: 'Dec 21v1',
        needsScraping: false,
      },
    );
  });

  it('returns needsScraping: true on getCurrentFccDataVersion error', async () => {
    mockGetCurrentFccDataVersion.mockRejectedValue(new Error('boom'));

    const mockRepo = createMockRepository({ dataVersion: 'Dec 21v1' });

    const result = await checkIfScrapingNeeded(
      mockRepo as unknown as DynamoDBBroadbandSignalRepository,
      timestamp,
      false,
    );
    expect(result).toEqual({ needsScraping: true });
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to check data versions, defaulting to scrape',
      expect.any(Error),
    );
  });
});
