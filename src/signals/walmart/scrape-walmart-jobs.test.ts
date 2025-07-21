import puppeteer from 'puppeteer';
import { scrapeWalmartJobs } from './scrape-walmart-jobs';
import { searchWalmartJobsInState } from './search-jobs-in-state';
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

const mockSearch = searchWalmartJobsInState as jest.MockedFunction<
  typeof searchWalmartJobsInState
>;

const mockBrowser = {
  close: jest.fn(),
};

(puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
    (cb as () => void)();
    return 0 as unknown as NodeJS.Timeout;
  });
  mockSearch.mockResolvedValue(5);
});
afterEach(() => jest.useRealTimers());

describe('scrapeWalmartJobs', () => {
  it('scrapes directly when no repository or timestamp is provided', async () => {
    const result = await scrapeWalmartJobs();
    expect(puppeteer.launch).toHaveBeenCalled();
    expect(mockSearch).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      physicalJobs: { CA: 5, TX: 5 },
      technologyJobs: { CA: 5, TX: 5 },
    });
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('uses existing data from repositories if found', async () => {
    const mockRepo = {
      exists: jest.fn().mockResolvedValue(true),
      get: jest
        .fn()
        .mockResolvedValueOnce({ state: 'CA', jobCount: 3 })
        .mockResolvedValueOnce({ state: 'CA', jobCount: 4 })
        .mockResolvedValueOnce({ state: 'TX', jobCount: 7 })
        .mockResolvedValueOnce({ state: 'TX', jobCount: 8 }),
      save: jest.fn(),
    };
    const res = await scrapeWalmartJobs(mockRepo, mockRepo, 123);
    expect(mockRepo.exists).toHaveBeenCalledTimes(4);
    expect(mockRepo.get).toHaveBeenCalledTimes(4);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(res).toEqual({
      physicalJobs: { CA: 3, TX: 7 },
      technologyJobs: { CA: 4, TX: 8 },
    });
  });

  it('scrapes and stores if data does not exist in repo', async () => {
    const mockRepo = {
      exists: jest.fn().mockResolvedValue(false),
      get: jest.fn(),
      save: jest.fn(),
    };
    const res = await scrapeWalmartJobs(mockRepo, mockRepo, 456);
    expect(mockRepo.exists).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalledTimes(4);
    expect(res.physicalJobs.CA).toBe(5);
  });

  it('falls back to scraping if repository fails', async () => {
    const mockRepo = {
      exists: jest.fn().mockRejectedValue(new Error('fail')),
      get: jest.fn(),
      save: jest.fn(),
    };
    const res = await scrapeWalmartJobs(mockRepo, mockRepo, 789);
    expect(mockSearch).toHaveBeenCalledTimes(4);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to process data for CA',
      expect.anything(),
    );
    expect(res.physicalJobs).toHaveProperty('CA');
  });

  it('handles browser close failure', async () => {
    mockBrowser.close.mockRejectedValueOnce(new Error('close fail'));
    await expect(scrapeWalmartJobs()).rejects.toThrow('close fail');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close browser: ',
      expect.any(Error),
    );
  });
});
