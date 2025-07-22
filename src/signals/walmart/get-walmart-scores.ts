import { CONFIG } from '../../config';
import { WalmartSignalRepository, WalmartJobRecord } from '../../types/walmart';
import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';
import { getWorkforceData } from '../amazon/get-workforce-data';
import { scrapeWalmartJobs } from './scrape-walmart-jobs';
import { logger } from '../../util';
import { WalmartSlidingWindowService } from '../../services/walmart/walmart-sliding-window-service';
import { orchestrateSignal } from '../shared-job-signal-orchestration';

const DEFAULT_WALMART_TABLE = 'blockbuster-index-walmart-jobs-dev';

function getStartOfDayTimestamp(date: Date = new Date()): number {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds.
}

export const getWalmartScores = async (): Promise<{
  scores: Record<string, number>;
}> => {
  const timestamp = getStartOfDayTimestamp();

  let walmartRepository: WalmartSignalRepository<WalmartJobRecord> | undefined =
    undefined;
  let slidingWindowService: WalmartSlidingWindowService | undefined = undefined;

  if (!CONFIG.IS_DEVELOPMENT || process.env.WALMART_DYNAMODB_TABLE_NAME) {
    const { DynamoDBWalmartJobRepository } = await import(
      '../../repositories/walmart/walmart-physical-repository'
    );
    walmartRepository = new DynamoDBWalmartJobRepository(
      process.env.WALMART_DYNAMODB_TABLE_NAME || DEFAULT_WALMART_TABLE,
    );
    slidingWindowService = new WalmartSlidingWindowService();
  }

  const { walmartJobs } = await scrapeWalmartJobs(walmartRepository, timestamp);

  if (slidingWindowService) {
    const scores = await orchestrateSignal({
      scraper: async () => walmartJobs,
      slidingWindowService,
      getWorkforceData,
      normalizeScores: calculateWorkforceNormalizedScores,
      timestamp,
      logger,
    });
    return { scores };
  }

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
