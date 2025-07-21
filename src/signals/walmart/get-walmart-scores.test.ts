import 'jest';

jest.mock('./scrape-walmart-jobs');
jest.mock('./calculate-inverted-scores');
jest.mock('./calculate-positive-scores');
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

import { scrapeWalmartJobs } from './scrape-walmart-jobs';
import { calculateInvertedScores } from './calculate-inverted-scores';
import { calculatePositiveScores } from './calculate-positive-scores';
import { WalmartSlidingWindowService } from '../../services/walmart/walmart-sliding-window-service';
import { CONFIG } from '../../config';
import { logger } from '../../util';
import { getWalmartScores } from './get-walmart-scores';

const mockScrapeWalmartJobs = scrapeWalmartJobs as jest.MockedFunction<
  typeof scrapeWalmartJobs
>;
const mockCalcInv = calculateInvertedScores as jest.MockedFunction<
  typeof calculateInvertedScores
>;
const mockCalcPos = calculatePositiveScores as jest.MockedFunction<
  typeof calculatePositiveScores
>;
const MockWindowService = WalmartSlidingWindowService as jest.MockedClass<
  typeof WalmartSlidingWindowService
>;
const mockLogger = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

describe('getWalmartScores()', () => {
  const DFLT_PHYS = 'blockbuster-index-walmart-physical-jobs-dev';
  const DFLT_TECH = 'blockbuster-index-walmart-technology-jobs-dev';

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WALMART_PHYSICAL_DYNAMODB_TABLE_NAME;
    delete process.env.WALMART_TECHNOLOGY_DYNAMODB_TABLE_NAME;
    CONFIG.IS_DEVELOPMENT = false;
  });

  it('computes scores through the sliding‑window path (prod / no env vars)', async () => {
    const physicalJobs = { CA: 10, TX: 20 };
    const technologyJobs = { CA: 5, TX: 15 };
    mockScrapeWalmartJobs.mockResolvedValue({ physicalJobs, technologyJobs });

    const slidingCounts = { CA: 100, TX: 200 };
    const updateSlidingWindow = jest.fn();
    const getSlidingScores = jest.fn().mockResolvedValue(slidingCounts);
    MockWindowService.mockImplementation(
      () =>
        ({
          updateSlidingWindow,
          getSlidingWindowScores: getSlidingScores,
        }) as any,
    );

    mockCalcInv.mockImplementationOnce(() => ({ CA: 0.9, TX: 0.8 }));
    mockCalcPos.mockImplementationOnce(() => ({ CA: 0.05, TX: 0.2 }));

    const result = await getWalmartScores();

    expect(result).toEqual({
      physicalScores: { CA: 0.9, TX: 0.8 },
      technologyScores: { CA: 0.05, TX: 0.2 },
    });

    const {
      DynamoDBWalmartPhysicalRepository,
      DynamoDBWalmartTechnologyRepository,
    } = jest.requireMock('../../repositories');
    expect(DynamoDBWalmartPhysicalRepository).toHaveBeenCalledWith(DFLT_PHYS);
    expect(DynamoDBWalmartTechnologyRepository).toHaveBeenCalledWith(DFLT_TECH);
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
    expect(getSlidingScores).toHaveBeenCalled();

    expect(mockCalcInv).toHaveBeenCalledWith(slidingCounts);
    expect(mockCalcPos).toHaveBeenCalledWith(technologyJobs);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Walmart job presence calculation completed with sliding window...',
      ),
      expect.objectContaining({ totalStates: 2, windowDays: 90 }),
    );
  });

  it('falls back to direct calculation in pure development mode', async () => {
    CONFIG.IS_DEVELOPMENT = true;

    const physicalJobs = { OR: 3, WA: 4 };
    const technologyJobs = { OR: 1, WA: 0 };

    mockScrapeWalmartJobs.mockResolvedValue({ physicalJobs, technologyJobs });
    mockCalcInv.mockImplementationOnce(() => ({ OR: 0.2, WA: 0.05 }));
    mockCalcPos.mockImplementationOnce(() => ({ OR: 0.2, WA: 0.05 }));

    const res = await getWalmartScores();

    expect(res).toEqual({
      physicalScores: { OR: 0.2, WA: 0.05 },
      technologyScores: { OR: 0.2, WA: 0.05 },
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
    const getSlidingScores = jest.fn().mockResolvedValue({});
    MockWindowService.mockImplementation(
      () =>
        ({
          updateSlidingWindow,
          getSlidingWindowScores: getSlidingScores,
        }) as any,
    );

    mockCalcInv.mockImplementationOnce(() => ({ OR: 0.2, WA: 0.05 }));
    mockCalcPos.mockImplementationOnce(() => ({ OR: 0.2, WA: 0.05 }));

    const res = await getWalmartScores();
    expect(res).toEqual({
      physicalScores: { OR: 0.2, WA: 0.05 },
      technologyScores: { OR: 0.2, WA: 0.05 },
    });

    const {
      DynamoDBWalmartPhysicalRepository,
      DynamoDBWalmartTechnologyRepository,
    } = jest.requireMock('../../repositories');
    expect(DynamoDBWalmartPhysicalRepository).toHaveBeenCalledWith('my‑phys');
    expect(DynamoDBWalmartTechnologyRepository).toHaveBeenCalledWith('my‑tech');

    expect(updateSlidingWindow).toHaveBeenCalledTimes(2);
    expect(getSlidingScores).toHaveBeenCalled();
  });

  it('propagates errors from scrapeWalmartJobs()', async () => {
    mockScrapeWalmartJobs.mockRejectedValue(new Error('network‑kaboom'));

    await expect(getWalmartScores()).rejects.toThrow('network‑kaboom');

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('network‑kaboom'),
    );
  });
});
