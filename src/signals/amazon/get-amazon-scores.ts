import { logger } from '../../util';
import { calculateScores } from './calculate-scores';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { getEqualScores } from './get-equal-scores';
import { DynamoDBJobSignalRepository } from '../../repositories';
import { CONFIG } from '../../config';
import type { JobSignalRepository } from '../../types';

export async function getAmazonScores(
  repository?: JobSignalRepository,
  timestamp?: number,
): Promise<Record<string, number>> {
  logger.info('Starting Amazon job presence calculation...');

  try {
    // Set up repository and timestamp for production data storage if not provided
    let finalRepository = repository;
    let finalTimestamp = timestamp;

    if (!repository) {
      // Store data if we're in a container environment (Docker/ECS) or explicitly in production
      const isContainerEnvironment =
        process.env.NODE_ENV === 'development' &&
        process.env.DYNAMODB_TABLE_NAME;
      const isProduction = !CONFIG.IS_DEVELOPMENT;

      if (isContainerEnvironment || isProduction) {
        const tableName =
          process.env.DYNAMODB_TABLE_NAME ||
          'blockbuster-index-amazon-jobs-dev';
        const region = process.env.AWS_REGION || 'us-west-2';
        finalRepository = new DynamoDBJobSignalRepository(tableName, region);

        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setUTCHours(0, 0, 0, 0);
        finalTimestamp = Math.floor(startOfDay.getTime() / 1000);
      }
    }

    const jobCounts = await scrapeAmazonJobs(finalRepository, finalTimestamp);
    const scores = calculateScores(jobCounts);

    logger.info('Amazon job presence calculation completed...', {
      totalStates: Object.keys(scores).length,
      totalJobs: Object.values(jobCounts).reduce(
        (sum, count) => sum + count,
        0,
      ),
    });

    return scores;
  } catch (error) {
    logger.error('Failed to calculate Amazon job scores: ', error);
    return getEqualScores();
  }
}

export default getAmazonScores;
