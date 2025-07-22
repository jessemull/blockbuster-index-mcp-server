import 'jest';

jest.mock('./scrape-walmart-jobs');
jest.mock('../../services/walmart/walmart-sliding-window-service', () => ({
  WalmartSlidingWindowService: jest.fn(),
}));
jest.mock('../../config', () => ({
  CONFIG: { IS_DEVELOPMENT: false },
}));
jest.mock('../../util', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../repositories', () => ({
  DynamoDBWalmartPhysicalRepository: jest.fn(),
  DynamoDBWalmartTechnologyRepository: jest.fn(),
}));
jest.mock('../amazon/get-workforce-data', () => ({
  getWorkforceData: jest.fn(),
}));

import { scrapeWalmartJobs } from './scrape-walmart-jobs';
import { WalmartSlidingWindowService } from '../../services/walmart/walmart-sliding-window-service';
import { CONFIG } from '../../config';
import { logger } from '../../util';
import { getWalmartScores } from './get-walmart-scores';
import { getWorkforceData } from '../amazon/get-workforce-data';

const mockScrapeWalmartJobs = scrapeWalmartJobs as jest.MockedFunction<
  typeof scrapeWalmartJobs
>;
const MockWindowService = WalmartSlidingWindowService as jest.MockedClass<
  typeof WalmartSlidingWindowService
>;
const mockLogger = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};
const mockGetWorkforceData = getWorkforceData as jest.MockedFunction<
  typeof getWorkforceData
>;

describe('getWalmartScores()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WALMART_PHYSICAL_DYNAMODB_TABLE_NAME;
    delete process.env.WALMART_TECHNOLOGY_DYNAMODB_TABLE_NAME;
    CONFIG.IS_DEVELOPMENT = false;

    // Mock workforce data
    mockGetWorkforceData.mockResolvedValue({
      CA: 2000000,
      TX: 1500000,
      OR: 1000000,
      WA: 1200000,
    });
  });

  it('computes scores through the sliding‑window path (prod / no env vars)', async () => {
    const walmartJobs = { CA: 10, TX: 20 };
    mockScrapeWalmartJobs.mockResolvedValue({ walmartJobs });

    const slidingCounts = { CA: 100, TX: 200 };
    const updateSlidingWindow = jest.fn();
    const getSlidingWindowScores = jest
      .fn()
      .mockResolvedValueOnce(slidingCounts)
      .mockResolvedValueOnce({});
    MockWindowService.mockImplementation(
      () =>
        ({
          updateSlidingWindow,
          getSlidingWindowScores,
        }) as any,
    );

    const result = await getWalmartScores();

    expect(result).toEqual({
      scores: { CA: 5000, TX: 13333 },
    });

    expect(MockWindowService).toHaveBeenCalledTimes(1);

    expect(updateSlidingWindow).toHaveBeenCalledTimes(2);
    expect(updateSlidingWindow).toHaveBeenCalledWith(
      'CA',
      10,
      expect.any(Number),
    );
    expect(updateSlidingWindow).toHaveBeenCalledWith(
      'TX',
      20,
      expect.any(Number),
    );
    expect(getSlidingWindowScores).toHaveBeenCalledTimes(1);
    expect(getSlidingWindowScores).toHaveBeenCalledWith();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Walmart job presence calculation completed with sliding window and workforce normalization...',
      ),
      expect.objectContaining({ totalStates: 2, windowDays: 90 }),
    );
  });

  it('falls back to direct calculation in pure development mode', async () => {
    CONFIG.IS_DEVELOPMENT = true;

    const walmartJobs = { OR: 3, WA: 4 };
    mockScrapeWalmartJobs.mockResolvedValue({ walmartJobs });

    const res = await getWalmartScores();

    expect(res).toEqual({
      scores: { OR: 300, WA: 333 },
    });

    expect(MockWindowService).not.toHaveBeenCalled();
  });

  it('still uses DynamoDB if table names are supplied in development', async () => {
    CONFIG.IS_DEVELOPMENT = true;
    process.env.WALMART_PHYSICAL_DYNAMODB_TABLE_NAME = 'my‑phys';
    process.env.WALMART_TECHNOLOGY_DYNAMODB_TABLE_NAME = 'my‑tech';

    const walmartJobs = { OR: 3, WA: 4 };
    mockScrapeWalmartJobs.mockResolvedValue({ walmartJobs });

    const updateSlidingWindow = jest.fn();
    const getSlidingWindowScores = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    MockWindowService.mockImplementation(
      () =>
        ({
          updateSlidingWindow,
          getSlidingWindowScores,
        }) as any,
    );

    const res = await getWalmartScores();
    expect(res).toEqual({
      scores: { OR: 300, WA: 333 },
    });

    expect(updateSlidingWindow).toHaveBeenCalledTimes(0);
    expect(getSlidingWindowScores).toHaveBeenCalledTimes(0);
  });

  it('propagates errors from scrapeWalmartJobs()', async () => {
    mockScrapeWalmartJobs.mockRejectedValue(new Error('network‑kaboom'));

    await expect(getWalmartScores()).rejects.toThrow('network‑kaboom');

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('network‑kaboom'),
    );
  });
});
