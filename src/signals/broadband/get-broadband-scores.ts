import * as fs from 'fs';
import * as path from 'path';
import { BroadbandService } from '../../services/broadband-service';
import { BroadbandSignalRecord } from '../../types';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband-signal-repository';
import { States } from '../../types';
import { checkIfScrapingNeeded } from './check-if-scraping-needed';
import { logger } from '../../util/logger';
import { scrapeBroadbandData } from './scrape-broadband-data';

const getStartOfDayTimestamp = (date: Date = new Date()): number => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay.getTime();
};

// Get the current FCC data version by scraping the FCC broadband page...

// Load existing broadband data from DynamoDB for today's timestamp...

async function loadExistingBroadbandData(
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
