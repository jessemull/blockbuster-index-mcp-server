import { CONFIG } from '../../config';
import { LoggerFactory } from '../../util/logger';
import { BroadbandService } from '../../services';
import type { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband';

const logger = LoggerFactory.getBroadbandLogger();

const DEFAULT_TABLE = 'blockbuster-index-broadband-signals-dev';

export const getBroadbandScores = async (): Promise<Record<string, number>> => {
  logger.info('Getting broadband scores from S3...');

  try {
    let repository: DynamoDBBroadbandSignalRepository | undefined = undefined;

    if (!CONFIG.IS_DEVELOPMENT || process.env.BROADBAND_DYNAMODB_TABLE_NAME) {
      const { DynamoDBBroadbandSignalRepository } = await import(
        '../../repositories'
      );
      repository = new DynamoDBBroadbandSignalRepository(
        process.env.BROADBAND_DYNAMODB_TABLE_NAME || DEFAULT_TABLE,
      );
    }

    const broadbandService = new BroadbandService(repository);

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
