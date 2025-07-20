import { CONFIG } from '../../config';
import { CensusSignalRecord } from '../../types/census';
import { SignalRepository } from '../../types/amazon';
import { States } from '../../types/states';
import { logger } from '../../util';

const DEFAULT_CENSUS_TABLE = 'blockbuster-index-census-signals-dev';

export const getWorkforceData = async (): Promise<Record<string, number>> => {
  logger.info('Fetching workforce data from census repository...');

  let repository: SignalRepository<CensusSignalRecord> | null = null;

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
  const currentYear = new Date().getFullYear();

  for (let yearOffset = 1; yearOffset <= 3; yearOffset++) {
    const yearToTry = currentYear - yearOffset;
    const timestamp = Math.floor(new Date(yearToTry, 0, 1).getTime() / 1000);

    try {
      const states = Object.values(States);

      for (const state of states) {
        const record = await repository.get(state, timestamp);
        if (record && record.workforce) {
          workforceData[state] = record.workforce;
        }
      }

      if (Object.keys(workforceData).length > 0) {
        logger.info(
          `Successfully retrieved workforce data for ${Object.keys(workforceData).length} states from year ${yearToTry}`,
        );
        return workforceData;
      }
    } catch (error) {
      logger.warn(
        `Failed to retrieve workforce data for year ${yearToTry}, trying previous year`,
        error,
      );
    }
  }

  throw new Error(
    `No workforce data available in census repository for years ${currentYear - 1} through ${currentYear - 3}`,
  );
};

export default getWorkforceData;
