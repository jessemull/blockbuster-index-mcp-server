import { logger } from '../../util';
import { BlsService } from '../../services/bls/bls-service';

export async function getBlsScores(): Promise<Record<string, number>> {
  try {
    logger.info('Starting BLS data processing and score calculation...');

    const blsService = new BlsService();

    // Process all BLS data (this will handle file checking, processing, and signal calculation)...

    await blsService.processBlsData();

    // Get all calculated scores...

    const scores = await blsService.getAllScores();

    logger.info(
      `Successfully calculated BLS scores for ${Object.keys(scores).length} states`,
    );
    return scores;
  } catch (error) {
    logger.error('Error getting BLS scores:', error);
    throw error;
  }
}
