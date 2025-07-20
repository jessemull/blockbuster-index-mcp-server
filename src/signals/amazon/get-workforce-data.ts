import { CONFIG } from '../../config';
import { CensusSignalRepository } from '../../types/census';
import { States } from '../../types/states';
import { logger } from '../../util';

const DEFAULT_CENSUS_TABLE = 'blockbuster-index-census-signals-dev';

export const getWorkforceData = async (): Promise<Record<string, number>> => {
  logger.info('Fetching workforce data from census repository...');

  let repository: CensusSignalRepository | null = null;

  if (!CONFIG.IS_DEVELOPMENT || process.env.CENSUS_DYNAMODB_TABLE_NAME) {
    const { DynamoDBCensusSignalRepository } = await import(
      '../../repositories'
    );
    repository = new DynamoDBCensusSignalRepository(
      process.env.CENSUS_DYNAMODB_TABLE_NAME || DEFAULT_CENSUS_TABLE,
    );
  }

  if (!repository) {
    throw new Error('Census repository not available in development mode');
  }

  const workforceData: Record<string, number> = {};
  const states = Object.values(States);

  // Get the latest workforce data for each state
  for (const state of states) {
    try {
      const record = await repository.getLatest(state);
      if (record && record.workforce) {
        workforceData[state] = record.workforce;
      }
    } catch (error) {
      logger.warn(
        `Failed to retrieve workforce data for state ${state}`,
        error,
      );
    }
  }

  if (Object.keys(workforceData).length === 0) {
    throw new Error(
      'No workforce data available in census repository for any state',
    );
  }

  logger.info(
    `Successfully retrieved workforce data for ${Object.keys(workforceData).length} states from census repository`,
  );
  return workforceData;
};

export default getWorkforceData;
