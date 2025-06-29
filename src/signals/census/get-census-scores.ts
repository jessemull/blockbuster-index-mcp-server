import { CONFIG } from '../../config';
import { CensusSignalRecord } from '../../types/census';
import { SignalRepository } from '../../types/amazon';
import { fetchCensusData } from '../../services/census-service';
import { logger } from '../../util';

const getStartOfDayTimestamp = (date: Date): number => {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000);
};

export const getCensusScores = async (): Promise<Record<string, number>> => {
  logger.info('Starting Census retail establishment calculation...');

  const currentYear = new Date().getFullYear();

  // Try to find the most recent available Census data...
  // Start with previous year and go backwards until we find available data...

  let lastAvailableYear = currentYear - 1;
  let censusData = null;

  // Try up to 3 years back to find available data...

  for (let attempt = 0; attempt < 3; attempt++) {
    const yearToTry = currentYear - 1 - attempt;
    logger.info(
      `Attempting to fetch Census data for year ${yearToTry} (attempt ${attempt + 1}/3)`,
    );

    try {
      censusData = await fetchCensusData(yearToTry);
      lastAvailableYear = yearToTry;
      logger.info(
        `Successfully found Census data for year ${lastAvailableYear}`,
      );
      break;
    } catch (error) {
      logger.warn(
        `Census data not available for year ${yearToTry}, trying previous year`,
        error,
      );
      if (attempt === 2) {
        // If we've tried 3 years and still no data, throw the error...
        logger.error(
          `All attempts failed. Last error for year ${yearToTry}:`,
          error,
        );
        throw new Error(
          `No Census data available for years ${currentYear - 1} through ${currentYear - 3}`,
        );
      }
      logger.info(`Moving to next year (attempt ${attempt + 1} of 3)`);
    }
  }

  const timestamp = getStartOfDayTimestamp(new Date(lastAvailableYear, 0, 1));

  logger.info(
    `Using Census data for year ${lastAvailableYear} (current year: ${currentYear})`,
  );

  let repository: SignalRepository<CensusSignalRecord> | null = null;

  // Temporary debug logging for production troubleshooting
  logger.info('Census signal environment check:', {
    IS_DEVELOPMENT: CONFIG.IS_DEVELOPMENT,
    NODE_ENV: process.env.NODE_ENV,
    CENSUS_DYNAMODB_TABLE_NAME:
      process.env.CENSUS_DYNAMODB_TABLE_NAME || 'NOT_SET',
    AWS_REGION: process.env.AWS_REGION || 'NOT_SET',
  });

  // HARDCODED PRODUCTION MODE - always create repository
  console.log('=== HARDCODED CENSUS PRODUCTION MODE ===');
  const { DynamoDBCensusSignalRepository } = await import('../../repositories');
  const tableName = 'blockbuster-index-census-signals-prod';
  repository = new DynamoDBCensusSignalRepository(tableName);
  console.log('HARDCODED Census repository created with table:', tableName);

  const scores: Record<string, number> = {};
  const forceRefresh = process.env.FORCE_REFRESH === 'true';

  if (!censusData) {
    throw new Error('Failed to fetch Census data after multiple attempts');
  }

  for (const state of Object.keys(censusData.establishments)) {
    const establishmentCount = censusData.establishments[state];
    const population = censusData.population[state];

    if (population > 0) {
      const establishmentsPer100k = Math.round(
        (establishmentCount / population) * 100000,
      );
      scores[state] = establishmentsPer100k;

      if (repository) {
        let exists = false;
        if (!forceRefresh) {
          exists = await repository.exists(state, timestamp);
        }
        if (!exists || forceRefresh) {
          const record: CensusSignalRecord = {
            retailStores: establishmentsPer100k,
            state,
            timestamp,
          };
          await repository.save(record);
          logger.info(
            `Stored Census data for ${state}: ${establishmentsPer100k} establishments per 100k`,
          );
        } else {
          logger.info(
            `Record already exists for ${state} year ${lastAvailableYear}, skipping storage`,
          );
        }
      }
    } else {
      scores[state] = 0;
      logger.warn(`No population data for ${state}, setting score to 0`);
    }
  }

  logger.info(
    `Completed Census calculation: processed ${Object.keys(scores).length} states`,
  );
  return scores;
};
