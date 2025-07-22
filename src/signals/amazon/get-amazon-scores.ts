import { CONFIG } from '../../config';
import { SignalRepository, JobSignalRecord } from '../../types/amazon';
import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { logger } from '../../util';
import { AmazonSlidingWindowService } from '../../services/amazon/amazon-sliding-window-service';
import { getWorkforceData } from './get-workforce-data';
import { orchestrateSignal } from '../shared-job-signal-orchestration';

const DEFAULT_TABLE = 'blockbuster-index-amazon-jobs-dev';

function getStartOfDayTimestamp(date: Date = new Date()): number {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds.
}

export const getAmazonScores = async (): Promise<Record<string, number>> => {
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

  const jobCounts = await scrapeAmazonJobs(repository, timestamp);

  if (slidingWindowService) {
    return orchestrateSignal({
      scraper: async () => jobCounts,
      slidingWindowService,
      getWorkforceData,
      normalizeScores: calculateWorkforceNormalizedScores,
      timestamp,
      logger,
    });
  } else {
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
