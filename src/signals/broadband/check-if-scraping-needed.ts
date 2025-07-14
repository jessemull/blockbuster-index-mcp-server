import { logger } from '../../util/logger';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband-signal-repository';
import { getCurrentFccDataVersion } from './get-current-fcc-data-version';

export async function checkIfScrapingNeeded(
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
