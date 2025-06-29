import { calculateScores } from './calculate-scores';
import { getAmazonScores } from './get-amazon-scores';
import { getEqualScores } from './get-equal-scores';
import { logger } from '../../util';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { CONFIG } from '../../config';

jest.mock('./scrape-amazon-jobs');
jest.mock('./calculate-scores');
jest.mock('./get-equal-scores');
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

const mockCalculateScores = calculateScores as jest.MockedFunction<
  typeof calculateScores
>;

const mockGetEqualScores = getEqualScores as jest.MockedFunction<
  typeof getEqualScores
>;

const mockCONFIG = CONFIG as jest.Mocked<typeof CONFIG>;

describe('getAmazonScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns calculated scores when scrape succeeds', async () => {
    const mockJobCounts = { CA: 10, TX: 50 };
    const mockScores = { CA: 0.05, TX: 0.2 };

    mockScrapeAmazonJobs.mockResolvedValue(mockJobCounts);
    mockCalculateScores.mockReturnValue(mockScores);
    mockGetEqualScores.mockReturnValue({ CA: 0.1, TX: 0.1 });

    const scores = await getAmazonScores();

    expect(scores).toEqual(mockScores);
    expect(mockScrapeAmazonJobs).toHaveBeenCalled();
    expect(mockCalculateScores).toHaveBeenCalledWith(mockJobCounts);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Amazon job presence calculation completed...'),
      expect.objectContaining({
        totalJobs: 60,
        totalStates: 2,
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

    mockScrapeAmazonJobs.mockResolvedValue(mockJobCounts);
    mockCalculateScores.mockReturnValue(mockScores);
    mockGetEqualScores.mockReturnValue({ CA: 0.1, TX: 0.1 });

    const scores = await getAmazonScores();

    expect(scores).toEqual(mockScores);
    expect(mockScrapeAmazonJobs).toHaveBeenCalled();
    expect(mockCalculateScores).toHaveBeenCalledWith(mockJobCounts);
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Record already exists'),
    );
  });
});
