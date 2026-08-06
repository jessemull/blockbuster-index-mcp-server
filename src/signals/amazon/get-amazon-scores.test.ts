import { CONFIG } from '../../config';
import { AmazonSlidingWindowService } from '../../services/amazon/amazon-sliding-window-service';
import { getWorkforceData } from '../../services/census';
import { logger } from '../../util';
import { calculateWorkforceNormalizedScores } from '../../util/helpers';
import { getAmazonScores } from './get-amazon-scores';
import { getEqualScores } from './get-equal-scores';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';

jest.mock('./scrape-amazon-jobs');
jest.mock('../../util/helpers', () => ({
  calculateWorkforceNormalizedScores: jest.fn(),
}));
jest.mock('./get-equal-scores');
jest.mock('../../services/census', () => ({
  getWorkforceData: jest.fn(),
}));
jest.mock('../../services/amazon/amazon-sliding-window-service', () => ({
  AmazonSlidingWindowService: jest.fn(),
}));
jest.mock('../../config', () => ({
  CONFIG: {
    IS_DEVELOPMENT: false,
    AMAZON_DYNAMODB_TABLE_NAME: undefined as string | undefined,
  },
}));
jest.mock('../../util', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockScrapeAmazonJobs = scrapeAmazonJobs as jest.MockedFunction<
  typeof scrapeAmazonJobs
>;

const mockCalculateWorkforceNormalizedScores =
  calculateWorkforceNormalizedScores as jest.MockedFunction<
    typeof calculateWorkforceNormalizedScores
  >;

const mockGetEqualScores = getEqualScores as jest.MockedFunction<
  typeof getEqualScores
>;

const mockGetWorkforceData = getWorkforceData as jest.MockedFunction<
  typeof getWorkforceData
>;

const mockCONFIG = CONFIG as jest.Mocked<typeof CONFIG>;

const mockAmazonSlidingWindowService =
  AmazonSlidingWindowService as jest.MockedClass<
    typeof AmazonSlidingWindowService
  >;

describe('getAmazonScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCONFIG.IS_DEVELOPMENT = false;
    mockCONFIG.AMAZON_DYNAMODB_TABLE_NAME = undefined;
  });

  it('returns calculated scores when scrape succeeds', async () => {
    const mockJobCounts = { CA: 10, TX: 50 };
    const mockSlidingWindowJobCounts = {
      CA: 10,
      TX: 50,
    };
    const mockScores = {
      CA: 10,
      TX: 50,
    };

    const mockWorkforceData = { CA: 2000000, TX: 1500000 };

    mockScrapeAmazonJobs.mockResolvedValue(mockJobCounts);
    mockCalculateWorkforceNormalizedScores.mockReturnValue(mockScores);
    mockGetEqualScores.mockReturnValue({ CA: 0.1, TX: 0.1 });
    mockGetWorkforceData.mockResolvedValue(mockWorkforceData);

    const mockUpdateSlidingWindow = jest.fn();
    const mockGetSlidingWindowScores = jest
      .fn()
      .mockResolvedValue(mockSlidingWindowJobCounts);
    const mockInitializeSlidingWindowFromHistoricalData = jest.fn();
    mockAmazonSlidingWindowService.mockImplementation(
      () =>
        ({
          updateSlidingWindow: mockUpdateSlidingWindow,
          getSlidingWindowScores: mockGetSlidingWindowScores,
          initializeSlidingWindowFromHistoricalData:
            mockInitializeSlidingWindowFromHistoricalData,
        }) as any,
    );

    const scores = await getAmazonScores();

    expect(scores).toEqual(mockSlidingWindowJobCounts);
    expect(mockScrapeAmazonJobs).toHaveBeenCalled();
    expect(mockCalculateWorkforceNormalizedScores).toHaveBeenCalledWith(
      mockJobCounts,
      mockWorkforceData,
    );
    expect(mockUpdateSlidingWindow).toHaveBeenCalledTimes(2);
    expect(mockGetSlidingWindowScores).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Signal calculation completed with workforce normalization...',
      ),
      expect.objectContaining({
        normalizedScores: { CA: 10, TX: 50 },
        slidingWindowScores: { CA: 10, TX: 50 },
      }),
    );
  });

  it('throws error if scrape fails', async () => {
    const mockEqualScores = { CA: 0.1, TX: 0.1 };

    mockScrapeAmazonJobs.mockRejectedValue(new Error('Scrape failed'));
    mockGetEqualScores.mockReturnValue(mockEqualScores);

    await expect(getAmazonScores()).rejects.toThrow('Scrape failed');
  });

  it('skips repository creation in development mode without table name', async () => {
    mockCONFIG.IS_DEVELOPMENT = true;
    mockCONFIG.AMAZON_DYNAMODB_TABLE_NAME = undefined;
    const mockJobCounts = { CA: 10, TX: 50 };
    const mockScores = { CA: 0.05, TX: 0.2 };
    const mockWorkforceData = { CA: 2000000, TX: 1500000 };

    mockScrapeAmazonJobs.mockResolvedValue(mockJobCounts);
    mockCalculateWorkforceNormalizedScores.mockReturnValue(mockScores);
    mockGetEqualScores.mockReturnValue({ CA: 0.1, TX: 0.1 });
    mockGetWorkforceData.mockResolvedValue(mockWorkforceData);

    const scores = await getAmazonScores();

    expect(scores).toEqual(mockScores);
    expect(mockScrapeAmazonJobs).toHaveBeenCalled();
    expect(mockCalculateWorkforceNormalizedScores).toHaveBeenCalledWith(
      mockJobCounts,
      mockWorkforceData,
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Record already exists'),
    );
  });
});
