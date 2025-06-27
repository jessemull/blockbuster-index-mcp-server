import { Browser } from 'puppeteer';
import { searchJobsInState } from './searchJobsInState';
import { logger } from '../../util';

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockPage = {
  setUserAgent: jest.fn(),
  goto: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  close: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
} as unknown as Browser;

describe('searchJobsInState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPage.evaluate.mockResolvedValue(42);
    mockPage.waitForSelector.mockResolvedValue(undefined);
  });

  it('successfully searches jobs in a state', async () => {
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');

    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(mockPage.setUserAgent).toHaveBeenCalled();
    expect(mockPage.goto).toHaveBeenCalledWith(
      expect.stringContaining('CA%2C+United+States'),
      { waitUntil: 'networkidle2' },
    );
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(
      'button[name="desktopFilter_job_type"]',
      { timeout: 10000 },
    );
    expect(mockPage.evaluate).toHaveBeenCalled();
    expect(mockPage.close).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Found 42 jobs in CA');
    expect(result).toBe(42);
  });

  it('handles page.setUserAgent failure', async () => {
    mockPage.setUserAgent.mockRejectedValueOnce(new Error('UserAgent failed'));

    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('UserAgent failed');
  });

  it('handles page.goto failure', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('Navigation failed');
  });

  it('handles page.evaluate failure', async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error('Evaluate failed'));

    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('Evaluate failed');
  });

  it('handles page.close failure', async () => {
    mockPage.close.mockRejectedValueOnce(new Error('Close failed'));

    const result = await searchJobsInState(mockBrowser, 'CA', 'California');

    expect(result).toBe(42);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close page for CA: ',
      expect.any(Error),
    );
  });

  it('handles waitForSelector timeout gracefully', async () => {
    mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));

    const result = await searchJobsInState(mockBrowser, 'CA', 'California');

    expect(result).toBe(42);
  });
});
