import { logger } from '../../util';
import { calculateScores } from './calculate-scores';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { getEqualScores } from './get-equal-scores';
import { JobSignalRepository } from '../../repositories/job-signal-repository';

export async function getAmazonScores(
  repository?: JobSignalRepository,
  timestamp?: number,
): Promise<Record<string, number>> {
  logger.info('Starting Amazon job presence calculation...');

  try {
    const jobCounts = await scrapeAmazonJobs(repository, timestamp);
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
