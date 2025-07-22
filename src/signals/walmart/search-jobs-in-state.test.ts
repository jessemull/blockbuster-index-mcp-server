import { Browser } from 'puppeteer';
import { logger } from '../../util';
import { WALMART_JOBS_URL_TEMPLATE } from '../../constants/walmart';
import { searchWalmartJobsInState } from './search-jobs-in-state';
import { getJobCountFromPage } from './get-job-count-from-page';

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('./get-job-count-from-page');
const mockGetJobCountFromPage = getJobCountFromPage as jest.Mock;

describe('searchWalmartJobsInState', () => {
  const mockPage = {
    evaluate: jest.fn(),
    setUserAgent: jest.fn(),
    goto: jest.fn(),
    waitForSelector: jest.fn(),
    close: jest.fn(),
  };

  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
  } as unknown as Browser;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.setUserAgent.mockResolvedValue(undefined);
    mockPage.close.mockResolvedValue(undefined);
    mockGetJobCountFromPage.mockResolvedValue(123);
  });

  it('uses physical URL template', async () => {
    const result = await searchWalmartJobsInState(mockBrowser, 'CA');
    expect(mockPage.goto).toHaveBeenCalledWith(
      WALMART_JOBS_URL_TEMPLATE.replace('{STATE}', 'CA'),
      { waitUntil: 'networkidle2' },
    );
    expect(result).toBe(123);
  });

  it('uses technology URL template', async () => {
    const result = await searchWalmartJobsInState(mockBrowser, 'TX');
    expect(mockPage.goto).toHaveBeenCalledWith(
      WALMART_JOBS_URL_TEMPLATE.replace('{STATE}', 'TX'),
      { waitUntil: 'networkidle2' },
    );
    expect(result).toBe(123);
  });

  it('logs warning if job count selector not found', async () => {
    mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));
    const result = await searchWalmartJobsInState(mockBrowser, 'CA');
    expect(result).toBe(123);
    expect(logger.warn).toHaveBeenCalledWith(
      'Job count element not found for CA jobs',
    );
  });

  it('throws if navigation fails', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));
    await expect(searchWalmartJobsInState(mockBrowser, 'CA')).rejects.toThrow(
      'Navigation failed',
    );
  });

  it('throws if getJobCountFromPage fails', async () => {
    mockGetJobCountFromPage.mockRejectedValueOnce(new Error('Parse fail'));
    await expect(searchWalmartJobsInState(mockBrowser, 'CA')).rejects.toThrow(
      'Parse fail',
    );
  });

  it('logs and suppresses close error', async () => {
    mockPage.close.mockRejectedValueOnce(new Error('Close error'));
    const result = await searchWalmartJobsInState(mockBrowser, 'CA');
    expect(result).toBe(123);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close page for CA jobs: ',
      expect.any(Error),
    );
  });

  it('throws and logs if both scrape and close fail', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Main logic error'));
    mockPage.close.mockRejectedValueOnce(new Error('Close error'));
    await expect(searchWalmartJobsInState(mockBrowser, 'CA')).rejects.toThrow(
      'Main logic error',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to search jobs in CA: ',
      expect.any(Error),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close page for CA jobs: ',
      expect.any(Error),
    );
  });
});
