import { logger } from '../../util/logger';
import { BroadbandService } from '../../services/broadband-service';

export const getBroadbandScores = async (): Promise<Record<string, number>> => {
  logger.info('Getting broadband scores from S3...');

  try {
    const broadbandService = new BroadbandService();

    // Process broadband data from S3...

    await broadbandService.processBroadbandData();

    // Get the scores from DynamoDB...

    const scores = await broadbandService.getAllScores();

    logger.info(
      `Retrieved broadband scores for ${Object.keys(scores || {}).length} states`,
    );

    return scores || {};
  } catch (error) {
    logger.error('Error getting broadband scores:', error);
    throw error;
  }
};
