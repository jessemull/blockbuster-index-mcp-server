import puppeteer from 'puppeteer';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { searchJobsInState } from './search-jobs-in-state';
import { logger } from '../../util';

jest.mock('puppeteer');

jest.mock('./search-jobs-in-state');

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../types', () => ({
  States: {
    CA: 'CA',
    TX: 'TX',
  },
}));

jest.mock('../../constants', () => ({
  STATE_ABBR_TO_NAME: {
    CA: 'California',
    TX: 'Texas',
  },
}));

const mockSearchJobsInState = searchJobsInState as jest.MockedFunction<
  typeof searchJobsInState
>;

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
};

describe('scrapeAmazonJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      (cb as () => void)();
      return 0 as unknown as NodeJS.Timeout;
    });
    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    mockSearchJobsInState.mockResolvedValue(42);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('scrapes job counts correctly for all states', async () => {
    const jobs = await scrapeAmazonJobs();

    expect(puppeteer.launch).toHaveBeenCalled();
    expect(mockSearchJobsInState).toHaveBeenCalledTimes(2);
    expect(mockSearchJobsInState).toHaveBeenCalledWith(
      mockBrowser,
      'CA',
      'California',
    );
    expect(mockSearchJobsInState).toHaveBeenCalledWith(
      mockBrowser,
      'TX',
      'Texas',
    );
    expect(mockBrowser.close).toHaveBeenCalled();
    expect(jobs).toEqual({ CA: 42, TX: 42 });
  });

  it('handles browser launch failure', async () => {
    (puppeteer.launch as jest.Mock).mockRejectedValueOnce(
      new Error('Browser failed'),
    );
    await expect(scrapeAmazonJobs()).rejects.toThrow('Browser failed');
  });

  it('handles searchJobsInState failure', async () => {
    mockSearchJobsInState.mockRejectedValueOnce(new Error('Search failed'));
    await expect(scrapeAmazonJobs()).rejects.toThrow('Search failed');
  });

  it('handles browser.close failure', async () => {
    mockBrowser.close.mockRejectedValueOnce(new Error('Browser close failed'));
    await expect(scrapeAmazonJobs()).rejects.toThrow('Browser close failed');
  });

  describe('with repository storage', () => {
    const mockRepository = {
      exists: jest.fn(),
      save: jest.fn(),
      query: jest.fn(),
      saveBatch: jest.fn(),
    };
    const timestamp = 1234567890;

    beforeEach(() => {
      jest.clearAllMocks();
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.save.mockResolvedValue(undefined);
    });

    it('stores job counts when repository and timestamp are provided', async () => {
      const jobs = await scrapeAmazonJobs(mockRepository, timestamp);

      expect(mockRepository.exists).toHaveBeenCalledTimes(2);
      expect(mockRepository.exists).toHaveBeenCalledWith('CA', timestamp);
      expect(mockRepository.exists).toHaveBeenCalledWith('TX', timestamp);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(mockRepository.save).toHaveBeenCalledWith({
        state: 'CA',
        timestamp,
        jobCount: 42,
      });
      expect(mockRepository.save).toHaveBeenCalledWith({
        state: 'TX',
        timestamp,
        jobCount: 42,
      });
      expect(logger.info).toHaveBeenCalledWith('Stored job count for CA', {
        state: 'CA',
        jobCount: 42,
        timestamp,
      });
      expect(jobs).toEqual({ CA: 42, TX: 42 });
    });

    it('skips storage when record already exists', async () => {
      mockRepository.exists.mockResolvedValue(true);

      const jobs = await scrapeAmazonJobs(mockRepository, timestamp);

      expect(mockRepository.exists).toHaveBeenCalledTimes(2);
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Record already exists for CA today, skipping storage',
        {
          state: 'CA',
          timestamp,
        },
      );
      expect(jobs).toEqual({ CA: 42, TX: 42 });
    });

    it('continues processing when storage fails for one state', async () => {
      mockRepository.save
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('Storage failed')); // Second call fails

      const jobs = await scrapeAmazonJobs(mockRepository, timestamp);

      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store job count for TX',
        {
          state: 'TX',
          jobCount: 42,
          error: new Error('Storage failed'),
          timestamp,
        },
      );
      expect(jobs).toEqual({ CA: 42, TX: 42 });
    });

    it('handles repository exists check failure', async () => {
      mockRepository.exists.mockRejectedValue(new Error('Exists check failed'));

      const jobs = await scrapeAmazonJobs(mockRepository, timestamp);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store job count for CA',
        {
          state: 'CA',
          jobCount: 42,
          error: new Error('Exists check failed'),
          timestamp,
        },
      );
      expect(jobs).toEqual({ CA: 42, TX: 42 });
    });

    it('does not store when repository is not provided', async () => {
      const jobs = await scrapeAmazonJobs(undefined, undefined);

      expect(mockRepository.exists).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(jobs).toEqual({ CA: 42, TX: 42 });
    });

    it('does not store when timestamp is not provided', async () => {
      const jobs = await scrapeAmazonJobs(mockRepository, undefined);

      expect(mockRepository.exists).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(jobs).toEqual({ CA: 42, TX: 42 });
    });
  });
});
