import puppeteer from 'puppeteer';
import { logger } from '../../util';
import { States } from '../../types';
import { searchWalmartJobsInState } from './search-jobs-in-state';
import type {
  WalmartSignalRepository,
  WalmartJobRecord,
} from '../../types/walmart';

export async function scrapeWalmartJobs(
  walmartRepository?: WalmartSignalRepository<WalmartJobRecord>,
  timestamp?: number,
): Promise<{
  walmartJobs: Record<string, number>;
}> {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const walmartJobCounts: Record<string, number> = {};

    // Initialize job count for all states...

    for (const state of Object.values(States)) {
      walmartJobCounts[state] = 0;
    }

    // Query job data per state, checking for existing data first...

    for (const state of Object.values(States)) {
      logger.info(`Processing Walmart jobs for ${state}`);
      let stateJobCount = 0;
      // Check if data already exists for today before scraping...

      if (walmartRepository && timestamp) {
        try {
          const exists = await walmartRepository.exists(state, timestamp);
          if (exists) {
            // Use existing data, don't scrape...

            const existingRecord = await walmartRepository.get(
              state,
              timestamp,
            );
            if (existingRecord) {
              stateJobCount = existingRecord.jobCount;
            }
            logger.info(
              `Using existing data for ${state}: ${stateJobCount} jobs`,
              {
                state,
                jobCount: stateJobCount,
                timestamp,
              },
            );
          } else {
            // Data doesn't exist, scrape and store...

            logger.info(`No existing data found for ${state}, scraping...`);
            stateJobCount = await searchWalmartJobsInState(browser, state);
            const record: WalmartJobRecord = {
              state,
              timestamp,
              jobCount: stateJobCount,
            };
            await walmartRepository.save(record);
            logger.info(`Stored job counts for ${state}`, {
              state,
              jobCount: stateJobCount,
              timestamp,
            });
          }
        } catch (storageError) {
          logger.error(`Failed to process data for ${state}`, {
            state,
            error: storageError,
            timestamp,
          });
          // Fallback to scraping if storage operations fail...

          logger.info(`Falling back to scraping for ${state}`);
          stateJobCount = await searchWalmartJobsInState(browser, state);
        }
      } else {
        // No repository, just scrape...

        stateJobCount = await searchWalmartJobsInState(browser, state);
      }
      walmartJobCounts[state] = stateJobCount;
    }
    return { walmartJobs: walmartJobCounts };
  } finally {
    await browser.close();
  }
}
