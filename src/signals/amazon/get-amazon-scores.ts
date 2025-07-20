import { CONFIG } from '../../config';
import { SignalRepository, JobSignalRecord } from '../../types/amazon';
import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { logger } from '../../util';
import { AmazonSlidingWindowService } from '../../services/amazon/amazon-sliding-window-service';
import { getWorkforceData } from './get-workforce-data';

const DEFAULT_TABLE = 'blockbuster-index-amazon-jobs-dev';

function getStartOfDayTimestamp(date: Date = new Date()): number {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds.
}

export const getAmazonScores = async (): Promise<Record<string, number>> => {
  logger.info(
    'Starting Amazon job presence calculation with sliding window...',
  );

  const timestamp = getStartOfDayTimestamp();

  let repository: SignalRepository<JobSignalRecord> | undefined = undefined;
  let slidingWindowService: AmazonSlidingWindowService | undefined = undefined;

  if (!CONFIG.IS_DEVELOPMENT || process.env.AMAZON_DYNAMODB_TABLE_NAME) {
    const { DynamoDBAmazonSignalRepository } = await import(
      '../../repositories'
    );
    repository = new DynamoDBAmazonSignalRepository(
      process.env.AMAZON_DYNAMODB_TABLE_NAME || DEFAULT_TABLE,
    );
    slidingWindowService = new AmazonSlidingWindowService();
  }

  // Get current day job counts and store them...

  const jobCounts = await scrapeAmazonJobs(repository, timestamp);

  // Update sliding window aggregates with new data...

  if (slidingWindowService) {
    for (const [state, jobCount] of Object.entries(jobCounts)) {
      await slidingWindowService.updateSlidingWindow(
        state,
        jobCount,
        timestamp * 1000, // Convert seconds to milliseconds.
      );
    }

    // Get scores from sliding window aggregates...

    const slidingWindowJobCounts =
      await slidingWindowService.getSlidingWindowScores();

    const workforceData = await getWorkforceData();
    const scores = calculateWorkforceNormalizedScores(
      slidingWindowJobCounts,
      workforceData,
    );

    logger.info(
      'Amazon job presence calculation completed with workforce normalization...',
      {
        totalStates: Object.keys(scores).length,
        totalJobs: Object.values(slidingWindowJobCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
        windowDays: 90,
      },
    );

    return scores;
  } else {
    // Fallback to workforce-normalized calculation for development without DynamoDB...

    const workforceData = await getWorkforceData();
    const scores = calculateWorkforceNormalizedScores(jobCounts, workforceData);

    logger.info(
      'Amazon job presence calculation completed with workforce normalization (fallback)...',
      {
        totalStates: Object.keys(scores).length,
        totalJobs: Object.values(jobCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
      },
    );

    return scores;
  }
};

export default getAmazonScores;
