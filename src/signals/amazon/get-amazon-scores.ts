import { CONFIG } from '../../config';
import { SignalRepository, JobSignalRecord } from '../../types/amazon';
import { calculateScores } from './calculate-scores';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { logger } from '../../util';

const DEFAULT_TABLE = 'blockbuster-index-amazon-jobs-dev';

export const getAmazonScores = async (): Promise<Record<string, number>> => {
  logger.info('Starting Amazon job presence calculation...');

  const timestamp = Math.floor(Date.now() / 1000);

  let repository: SignalRepository<JobSignalRecord> | undefined = undefined;

  if (!CONFIG.IS_DEVELOPMENT || process.env.AMAZON_DYNAMODB_TABLE_NAME) {
    const { DynamoDBAmazonSignalRepository } = await import(
      '../../repositories'
    );
    repository = new DynamoDBAmazonSignalRepository(
      process.env.AMAZON_DYNAMODB_TABLE_NAME || DEFAULT_TABLE,
    );
  }

  const jobCounts = await scrapeAmazonJobs(repository, timestamp);
  const scores = calculateScores(jobCounts);

  logger.info('Amazon job presence calculation completed...', {
    totalStates: Object.keys(scores).length,
    totalJobs: Object.values(jobCounts).reduce((sum, count) => sum + count, 0),
  });

  return scores;
};

export default getAmazonScores;
