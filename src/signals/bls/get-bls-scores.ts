import { logger } from '../../util';
import { BlsService } from '../../services/bls/bls-service';

export async function getBlsScores(): Promise<Record<string, number>> {
  try {
    logger.info('Starting BLS data processing and score calculation...');

    const blsService = new BlsService();

    // TEMPORARY TESTING - REMOVE AFTER TESTING
    if (process.env.BLS_TEST_SINGLE_STATE === 'true') {
      logger.info('TESTING: Running single state processing test...');
      await blsService.testSingleStateProcessing();
      return {}; // Return empty scores for testing
    }

    // Process all BLS data (this will handle file checking, processing, and signal calculation)...

    await blsService.processBlsData();

    // Get combined scores for blockbuster index (physicalScore + ecommerceScore) / 2

    const scores = await blsService.getAllScores();

    logger.info(
      `Successfully calculated BLS combined scores for ${Object.keys(scores).length} states`,
    );
    return scores;
  } catch (error) {
    logger.error('Error getting BLS scores:', error);
    throw error;
  }
}
