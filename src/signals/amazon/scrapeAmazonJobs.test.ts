import puppeteer from 'puppeteer';
import { scrapeAmazonJobs } from './scrapeAmazonJobs';
import { searchJobsInState } from './searchJobsInState';

jest.mock('puppeteer');

jest.mock('./searchJobsInState');

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
});
