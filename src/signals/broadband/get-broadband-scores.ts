import { logger } from '../../util/logger';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband-signal-repository';
import { BroadbandSignalRecord } from '../../types';
import { BroadbandService } from '../../services/broadband-service';
import { scrapeBroadbandData } from './scrape-broadband-data';
import { getCurrentFccDataVersion } from './get-current-fcc-data-version';
import { States } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

const getStartOfDayTimestamp = (date: Date = new Date()): number => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay.getTime();
};

// Get the current FCC data version by scraping the FCC broadband page...

// Check if we need to scrape new data by comparing FCC data version with our stored data...

async function checkIfScrapingNeeded(
  repository: DynamoDBBroadbandSignalRepository | undefined,
  timestamp: number,
  forceRefresh: boolean,
): Promise<{ needsScraping: boolean; currentDataVersion?: string }> {
  if (forceRefresh) {
    logger.info('Force refresh enabled, will scrape new data');
    return { needsScraping: true };
  }

  if (!repository) {
    logger.info('No repository available, will scrape new data');
    return { needsScraping: true };
  }

  try {
    // Get the current FCC data version from their website...

    const currentFccVersion = await getCurrentFccDataVersion();
    logger.info('Current FCC data version:', { version: currentFccVersion });

    // Check our most recent data (use California as reference state)...

    const existingRecord = await repository.get('CA', timestamp);

    if (!existingRecord || !existingRecord.dataVersion) {
      logger.info(
        'No existing data found or no version info, will scrape new data',
      );
      return { needsScraping: true, currentDataVersion: currentFccVersion };
    }

    const needsScraping = existingRecord.dataVersion !== currentFccVersion;

    logger.info('Data version comparison completed', {
      storedVersion: existingRecord.dataVersion,
      currentFccVersion,
      needsScraping,
    });

    return { needsScraping, currentDataVersion: currentFccVersion };
  } catch (error) {
    logger.error('Failed to check data versions, defaulting to scrape', error);
    return { needsScraping: true };
  }
}

// Load existing broadband data from DynamoDB for today's timestamp...

async function loadExistingBroadbandData(
  repository: DynamoDBBroadbandSignalRepository,
  timestamp: number,
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};

  for (const state of Object.values(States)) {
    // Load data for each state.
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

export const getBroadbandScores = async (): Promise<Record<string, number>> => {
  const repository = process.env.BROADBAND_DYNAMODB_TABLE_NAME
    ? new DynamoDBBroadbandSignalRepository(
        process.env.BROADBAND_DYNAMODB_TABLE_NAME,
      )
    : undefined;

  const timestamp = getStartOfDayTimestamp();
  const scores: Record<string, number> = {};
  const forceRefresh = process.env.FORCE_REFRESH === 'true';

  try {
    const { needsScraping, currentDataVersion } = await checkIfScrapingNeeded(
      // Check if we have recent broadband data in DynamoDB instead of filesystem...

      repository,
      timestamp,
      forceRefresh,
    );

    if (needsScraping) {
      logger.info(
        'No recent broadband data found in database, starting scraper...',
      );

      // Download CSV files to temporary directory...

      await scrapeBroadbandData();
      const dataDir = path.resolve(process.cwd(), 'data', 'broadband');

      if (!fs.existsSync(dataDir)) {
        logger.warn(
          'Scraper did not create data directory, using default scores',
        );
        return scores;
      }

      // Process all downloaded CSV files...

      const broadbandService = new BroadbandService();
      const csvFiles = fs
        .readdirSync(dataDir)
        .filter((file: string) => file.endsWith('.csv'));

      if (csvFiles.length === 0) {
        logger.warn('No CSV files found after scraping, using default scores');
        return scores;
      }

      logger.info(`Processing ${csvFiles.length} broadband CSV files`);

      for (const csvFile of csvFiles) {
        const csvPath = path.join(dataDir, csvFile);
        const metricsMap = await broadbandService.processBroadbandCsv(csvPath);

        for (const [state, metrics] of Object.entries(metricsMap)) {
          // Use the calculated broadband score from the service...

          scores[state] = metrics.broadbandScore;

          // Store in DynamoDB if repository is available...

          if (repository) {
            const record: BroadbandSignalRecord = {
              state,
              timestamp,
              dataVersion: currentDataVersion,
              ...metrics,
            };

            try {
              await repository.save(record);
              logger.info(`Stored broadband signal for ${state}`, {
                state,
                timestamp,
                dataVersion: currentDataVersion,
                score: metrics.broadbandScore,
              });
            } catch (error) {
              logger.error(
                `Failed to store broadband signal for ${state}`,
                error,
              );
            }
          }
        }
      }
    } else {
      logger.info('Using existing broadband data from database');

      // Load existing data from DynamoDB...

      if (repository) {
        const existingData = await loadExistingBroadbandData(
          repository,
          timestamp,
        );
        Object.assign(scores, existingData);
      }
    }

    logger.info('Broadband scores calculation completed', {
      totalStates: Object.keys(scores).length,
      sampleScores: Object.entries(scores).slice(0, 3),
    });

    return scores;
  } catch (error) {
    logger.error('Broadband scores calculation failed', error);
    throw error;
  }
};
