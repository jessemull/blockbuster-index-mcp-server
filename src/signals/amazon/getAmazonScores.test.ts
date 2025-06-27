import { calculateScores } from './calculateScores';
import { getAmazonScores } from './getAmazonScores';
import { getEqualScores } from './getEqualScores';
import { logger } from '../../util';
import { scrapeAmazonJobs } from './scrapeAmazonJobs';

jest.mock('./scrapeAmazonJobs');
jest.mock('./calculateScores');
jest.mock('./getEqualScores');
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

  it('returns equal scores if scrape fails', async () => {
    const mockEqualScores = { CA: 0.1, TX: 0.1 };

    mockScrapeAmazonJobs.mockRejectedValue(new Error('Scrape failed'));
    mockGetEqualScores.mockReturnValue(mockEqualScores);

    const scores = await getAmazonScores();

    expect(scores).toEqual(mockEqualScores);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to calculate Amazon job scores: '),
      expect.any(Error),
    );
  });
});
