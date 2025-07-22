import { CONFIG } from '../../config';
import { WalmartSignalRepository, WalmartJobRecord } from '../../types/walmart';
import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';
import { getWorkforceData } from '../amazon/get-workforce-data';
import { scrapeWalmartJobs } from './scrape-walmart-jobs';
import { logger } from '../../util';
import { WalmartSlidingWindowService } from '../../services/walmart/walmart-sliding-window-service';

const DEFAULT_WALMART_TABLE = 'blockbuster-index-walmart-jobs-dev';

function getStartOfDayTimestamp(date: Date = new Date()): number {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds.
}

export const getWalmartScores = async (): Promise<{
  scores: Record<string, number>;
}> => {
  logger.info(
    'Starting Walmart job presence calculation with sliding window...',
  );

  const timestamp = getStartOfDayTimestamp();

  let walmartRepository: WalmartSignalRepository<WalmartJobRecord> | undefined =
    undefined;
  let slidingWindowService: WalmartSlidingWindowService | undefined = undefined;

  if (!CONFIG.IS_DEVELOPMENT || process.env.WALMART_DYNAMODB_TABLE_NAME) {
    const { DynamoDBWalmartJobRepository } = await import('../../repositories');
    walmartRepository = new DynamoDBWalmartJobRepository(
      process.env.WALMART_DYNAMODB_TABLE_NAME || DEFAULT_WALMART_TABLE,
    );
    slidingWindowService = new WalmartSlidingWindowService();
  }

  // Get current day job counts and store them...
  const { walmartJobs } = await scrapeWalmartJobs(walmartRepository, timestamp);

  // Update sliding window aggregates with new data...
  if (slidingWindowService) {
    for (const [state, jobCount] of Object.entries(walmartJobs)) {
      await slidingWindowService.updateSlidingWindow(
        state,
        jobCount,
        timestamp * 1000, // Convert seconds to milliseconds.
      );
    }

    // Get workforce data for normalization
    const workforceData = await getWorkforceData();
    const slidingWindowJobCounts =
      await slidingWindowService.getSlidingWindowScores();
    const scores = calculateWorkforceNormalizedScores(
      slidingWindowJobCounts,
      workforceData,
    );

    logger.info(
      'Walmart job presence calculation completed with sliding window and workforce normalization...',
      {
        totalStates: Object.keys(scores).length,
        totalJobs: Object.values(slidingWindowJobCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
        windowDays: 90,
      },
    );

    return { scores };
  }

  // Fallback to workforce-normalized calculation for development without DynamoDB...
  const workforceData = await getWorkforceData();
  const scores = calculateWorkforceNormalizedScores(walmartJobs, workforceData);

  logger.info(
    'Walmart job presence calculation completed with workforce normalization (fallback)...',
    {
      totalStates: Object.keys(scores).length,
      totalJobs: Object.values(walmartJobs).reduce(
        (sum, count) => sum + count,
        0,
      ),
    },
  );

  return { scores };
};
