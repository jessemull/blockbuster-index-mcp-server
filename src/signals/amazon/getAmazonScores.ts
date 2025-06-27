import { logger } from '../../util';
import { calculateScores } from './calculateScores';
import { scrapeAmazonJobs } from './scrapeAmazonJobs';
import { getEqualScores } from './getEqualScores';

export async function getAmazonScores(): Promise<Record<string, number>> {
  logger.info('Starting Amazon job presence calculation...');

  try {
    const jobCounts = await scrapeAmazonJobs();
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
