import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';
import { getAmazonScores } from './get-amazon-scores';
import { getEqualScores } from './get-equal-scores';
import { getWorkforceData } from './get-workforce-data';
import { logger } from '../../util';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { CONFIG } from '../../config';
import { AmazonSlidingWindowService } from '../../services/amazon/amazon-sliding-window-service';

jest.mock('./scrape-amazon-jobs');
jest.mock('./calculate-workforce-normalized-scores');
jest.mock('./get-equal-scores');
jest.mock('./get-workforce-data');
jest.mock('../../services/amazon/amazon-sliding-window-service', () => ({
  AmazonSlidingWindowService: jest.fn(),
}));
jest.mock('../../config', () => ({
  CONFIG: {
    IS_DEVELOPMENT: false,
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
  });

  it('returns calculated scores when scrape succeeds', async () => {
    const mockJobCounts = { CA: 10, TX: 50 };
    const mockSlidingWindowJobCounts = {
      AK: 0,
      AL: 10,
      AR: 10,
      AZ: 267,
      CA: 1130,
      CO: 257,
      CT: 22,
      DE: 9,
      FL: 107,
      GA: 330,
      HI: 5,
      IA: 18,
      ID: 7,
      IL: 361,
      IN: 201,
      KS: 10,
      KY: 36,
      LA: 37,
      MA: 790,
      MD: 173,
      ME: 0,
      MI: 52,
      MN: 68,
      MO: 37,
      MS: 52,
      MT: 5,
      NC: 54,
      ND: 7,
      NE: 17,
      NH: 2,
      NJ: 143,
      NM: 12,
      NV: 42,
      NY: 1480,
      OH: 164,
      OK: 9,
      OR: 189,
      PA: 149,
      RI: 5,
      SC: 21,
      SD: 6,
      TN: 650,
      TX: 750,
      UT: 17,
      VA: 2020,
      VT: 0,
      WA: 5695,
      WI: 37,
      WV: 10,
      WY: 1,
    };
    const mockScores = {
      AK: 0,
      AL: 10,
      AR: 10,
      AZ: 267,
      CA: 1130,
      CO: 257,
      CT: 22,
      DE: 9,
      FL: 107,
      GA: 330,
      HI: 5,
      IA: 18,
      ID: 7,
      IL: 361,
      IN: 201,
      KS: 10,
      KY: 36,
      LA: 37,
      MA: 790,
      MD: 173,
      ME: 0,
      MI: 52,
      MN: 68,
      MO: 37,
      MS: 52,
      MT: 5,
      NC: 54,
      ND: 7,
      NE: 17,
      NH: 2,
      NJ: 143,
      NM: 12,
      NV: 42,
      NY: 1480,
      OH: 164,
      OK: 9,
      OR: 189,
      PA: 149,
      RI: 5,
      SC: 21,
      SD: 6,
      TN: 650,
      TX: 750,
      UT: 17,
      VA: 2020,
      VT: 0,
      WA: 5695,
      WI: 37,
      WV: 10,
      WY: 1,
    };

    const mockWorkforceData = { CA: 2000000, TX: 1500000 };

    mockScrapeAmazonJobs.mockResolvedValue(mockJobCounts);
    mockCalculateWorkforceNormalizedScores.mockReturnValue(mockScores);
    mockGetEqualScores.mockReturnValue({ CA: 0.1, TX: 0.1 });
    mockGetWorkforceData.mockResolvedValue(mockWorkforceData);

    // Mock the sliding window service
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

    expect(scores).toEqual(mockScores);
    expect(mockScrapeAmazonJobs).toHaveBeenCalled();
    expect(mockCalculateWorkforceNormalizedScores).toHaveBeenCalledWith(
      mockSlidingWindowJobCounts,
      mockWorkforceData,
    );
    expect(mockUpdateSlidingWindow).toHaveBeenCalledTimes(2); // Called for CA and TX
    expect(mockGetSlidingWindowScores).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Amazon job presence calculation completed with workforce normalization...',
      ),
      expect.objectContaining({
        totalJobs: 15474,
        totalStates: 50,
        windowDays: 90,
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
    delete process.env.AMAZON_DYNAMODB_TABLE_NAME;
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
