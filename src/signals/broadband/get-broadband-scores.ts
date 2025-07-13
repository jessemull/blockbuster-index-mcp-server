import { CONFIG } from '../../config';
import { BroadbandSignalRecord } from '../../types/broadband';
import { SignalRepository } from '../../types/amazon';
import { BroadbandService } from '../../services/broadband-service';
import { logger } from '../../util';

const DEFAULT_TABLE = 'blockbuster-index-broadband-signals-dev';

const getStartOfDayTimestamp = (date: Date = new Date()): number => {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000);
};

export const getBroadbandScores = async (): Promise<Record<string, number>> => {
  logger.info('Starting broadband infrastructure calculation...');

  const timestamp = getStartOfDayTimestamp();

  let repository: SignalRepository<BroadbandSignalRecord> | null = null;

  if (!CONFIG.IS_DEVELOPMENT || process.env.BROADBAND_DYNAMODB_TABLE_NAME) {
    const { DynamoDBBroadbandSignalRepository } = await import(
      '../../repositories'
    );
    repository = new DynamoDBBroadbandSignalRepository(
      process.env.BROADBAND_DYNAMODB_TABLE_NAME || DEFAULT_TABLE,
    );
  }

  const scores: Record<string, number> = {};
  const forceRefresh = process.env.FORCE_REFRESH === 'true';

  try {
    // For now, we'll use the Alaska CSV file for testing
    // In the future, this should download/process multiple state CSV files
    const csvPath =
      '/Users/jessemull/Development/blockbuster-index-mcp-server/AK-Fixed-Jun2021-v1.csv';

    const broadbandService = new BroadbandService();
    const metricsMap = await broadbandService.processBroadbandCsv(csvPath);

    for (const [state, metrics] of Object.entries(metricsMap)) {
      // Use the calculated broadband score from the service
      scores[state] = metrics.broadbandScore;

      // Store in DynamoDB if repository is available
      if (repository) {
        let exists = false;
        if (!forceRefresh) {
          exists = await repository.exists(state, timestamp);
        }

        if (!exists || forceRefresh) {
          const record: BroadbandSignalRecord = {
            state,
            timestamp,
            ...metrics,
          };

          await repository.save(record);
          logger.info(
            `Stored broadband data for ${state}: ${metrics.broadbandScore.toFixed(4)} score`,
          );
        } else {
          logger.info(
            `Broadband record already exists for ${state}, skipping storage`,
          );
        }
      }
    }

    // For testing, we'll only have Alaska data
    // In production, we need to ensure all states have scores
    // For now, set other states to 0 if they don't have data
    const allStates = [
      'AK',
      'AL',
      'AR',
      'AZ',
      'CA',
      'CO',
      'CT',
      'DE',
      'FL',
      'GA',
      'HI',
      'IA',
      'ID',
      'IL',
      'IN',
      'KS',
      'KY',
      'LA',
      'MA',
      'MD',
      'ME',
      'MI',
      'MN',
      'MO',
      'MS',
      'MT',
      'NC',
      'ND',
      'NE',
      'NH',
      'NJ',
      'NM',
      'NV',
      'NY',
      'OH',
      'OK',
      'OR',
      'PA',
      'RI',
      'SC',
      'SD',
      'TN',
      'TX',
      'UT',
      'VA',
      'VT',
      'WA',
      'WI',
      'WV',
      'WY',
    ];

    for (const state of allStates) {
      if (!(state in scores)) {
        scores[state] = 0;
        logger.warn(`No broadband data for ${state}, setting score to 0`);
      }
    }

    logger.info(
      `Completed broadband calculation: processed ${Object.keys(metricsMap).length} states with data`,
    );

    return scores;
  } catch (error) {
    logger.error('Failed to calculate broadband scores', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
