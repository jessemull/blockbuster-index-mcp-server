import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband-signal-repository';
import { States } from '../../types';
import { logger } from '../../util/logger';

// Load existing broadband data from DynamoDB for today's timestamp...

export async function loadExistingBroadbandData(
  repository: DynamoDBBroadbandSignalRepository,
  timestamp: number,
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};

  for (const state of Object.values(States)) {
    // Load data for each state...

    try {
      const record = await repository.get(state, timestamp);

      if (record) {
        scores[state] = record.broadbandScore;
      } else {
        scores[state] = 0;
      }
    } catch (error) {
      logger.error(`Failed to load broadband data for ${state}`, error);
      scores[state] = 0;
    }
  }

  logger.info('Loaded existing broadband data', {
    statesWithData: Object.values(scores).filter((score) => score > 0).length,
    totalStates: Object.keys(States).length,
  });

  return scores;
}
