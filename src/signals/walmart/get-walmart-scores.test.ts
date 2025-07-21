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
  const DFLT_PHYS = 'blockbuster-index-walmart-physical-jobs-dev';
  const DFLT_TECH = 'blockbuster-index-walmart-technology-jobs-dev';

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
    const physicalJobs = { CA: 10, TX: 20 };
    const technologyJobs = { CA: 5, TX: 15 };
    mockScrapeWalmartJobs.mockResolvedValue({ physicalJobs, technologyJobs });

    const physicalSlidingCounts = { CA: 100, TX: 200 };
    const technologySlidingCounts = { CA: 50, TX: 100 };
    const updateSlidingWindow = jest.fn();
    const getSlidingWindowScores = jest
      .fn()
      .mockResolvedValueOnce(physicalSlidingCounts)
      .mockResolvedValueOnce(technologySlidingCounts);
    MockWindowService.mockImplementation(
      () =>
        ({
          updateSlidingWindow,
          getSlidingWindowScores,
        }) as any,
    );

    const result = await getWalmartScores();

    expect(result).toEqual({
      physicalScores: { CA: 9995000, TX: 9986667 },
      technologyScores: { CA: 2500, TX: 6667 },
    });

    const {
      DynamoDBWalmartPhysicalRepository,
      DynamoDBWalmartTechnologyRepository,
    } = jest.requireMock('../../repositories');
    expect(DynamoDBWalmartPhysicalRepository).toHaveBeenCalledWith(DFLT_PHYS);
    expect(DynamoDBWalmartTechnologyRepository).toHaveBeenCalledWith(DFLT_TECH);
    expect(MockWindowService).toHaveBeenCalledTimes(1);

    expect(updateSlidingWindow).toHaveBeenCalledTimes(4);
    expect(updateSlidingWindow).toHaveBeenCalledWith(
      'CA',
      'physical',
      10,
      expect.any(Number),
    );
    expect(updateSlidingWindow).toHaveBeenCalledWith(
      'TX',
      'physical',
      20,
      expect.any(Number),
    );
    expect(updateSlidingWindow).toHaveBeenCalledWith(
      'CA',
      'technology',
      5,
      expect.any(Number),
    );
    expect(updateSlidingWindow).toHaveBeenCalledWith(
      'TX',
      'technology',
      15,
      expect.any(Number),
    );
    expect(getSlidingWindowScores).toHaveBeenCalledWith('physical');
    expect(getSlidingWindowScores).toHaveBeenCalledWith('technology');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Walmart job presence calculation completed with sliding window and workforce normalization...',
      ),
      expect.objectContaining({ totalStates: 2, windowDays: 90 }),
    );
  });

  it('falls back to direct calculation in pure development mode', async () => {
    CONFIG.IS_DEVELOPMENT = true;

    const physicalJobs = { OR: 3, WA: 4 };
    const technologyJobs = { OR: 1, WA: 0 };

    mockScrapeWalmartJobs.mockResolvedValue({ physicalJobs, technologyJobs });

    const res = await getWalmartScores();

    expect(res).toEqual({
      physicalScores: { OR: 9999700, WA: 9999667 },
      technologyScores: { OR: 100, WA: 0 },
    });

    expect(MockWindowService).not.toHaveBeenCalled();
    const { DynamoDBWalmartPhysicalRepository } =
      jest.requireMock('../../repositories');
    expect(DynamoDBWalmartPhysicalRepository).not.toHaveBeenCalled();
  });

  it('still uses DynamoDB if table names are supplied in development', async () => {
    CONFIG.IS_DEVELOPMENT = true;
    process.env.WALMART_PHYSICAL_DYNAMODB_TABLE_NAME = 'my‑phys';
    process.env.WALMART_TECHNOLOGY_DYNAMODB_TABLE_NAME = 'my‑tech';

    const physicalJobs = { OR: 3, WA: 4 };
    const technologyJobs = { OR: 1, WA: 0 };
    mockScrapeWalmartJobs.mockResolvedValue({ physicalJobs, technologyJobs });

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
      physicalScores: {},
      technologyScores: {},
    });

    const {
      DynamoDBWalmartPhysicalRepository,
      DynamoDBWalmartTechnologyRepository,
    } = jest.requireMock('../../repositories');
    expect(DynamoDBWalmartPhysicalRepository).toHaveBeenCalledWith('my‑phys');
    expect(DynamoDBWalmartTechnologyRepository).toHaveBeenCalledWith('my‑tech');

    expect(updateSlidingWindow).toHaveBeenCalledTimes(4);
    expect(getSlidingWindowScores).toHaveBeenCalledWith('physical');
    expect(getSlidingWindowScores).toHaveBeenCalledWith('technology');
  });

  it('propagates errors from scrapeWalmartJobs()', async () => {
    mockScrapeWalmartJobs.mockRejectedValue(new Error('network‑kaboom'));

    await expect(getWalmartScores()).rejects.toThrow('network‑kaboom');

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('network‑kaboom'),
    );
  });
});
