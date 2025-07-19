import puppeteer from 'puppeteer';
import { logger } from '../../util';
import { States } from '../../types';
import { STATE_ABBR_TO_NAME } from '../../constants';
import { searchJobsInState } from './search-jobs-in-state';
import type { SignalRepository, JobSignalRecord } from '../../types/amazon';

export async function scrapeAmazonJobs(
  repository?: SignalRepository<JobSignalRecord>,
  timestamp?: number,
): Promise<Record<string, number>> {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const jobCounts: Record<string, number> = {};

    // Initialize job count for all states...

    for (const state of Object.values(States)) {
      jobCounts[state] = 0;
    }

    // Query job data per state, checking for existing data first...

    for (const state of Object.values(States)) {
      logger.info(`Processing Amazon jobs for ${state}`);

      let stateJobCount = 0;

      // Check if data already exists for today before scraping...

      if (repository && timestamp) {
        try {
          const exists = await repository.exists(state, timestamp);

          if (exists) {
            // Use existing data, don't scrape
            const existingRecord = await repository.get(state, timestamp);
            if (existingRecord) {
              stateJobCount = existingRecord.jobCount;
              logger.info(
                `Using existing data for ${state}: ${stateJobCount} jobs`,
                {
                  state,
                  jobCount: stateJobCount,
                  timestamp,
                },
              );
            }
          } else {
            // Data doesn't exist, scrape and store
            logger.info(`No existing data found for ${state}, scraping...`);
            const region = STATE_ABBR_TO_NAME[state];
            stateJobCount = await searchJobsInState(browser, state, region);

            const record: JobSignalRecord = {
              state,
              timestamp,
              jobCount: stateJobCount,
            };

            await repository.save(record);

            logger.info(`Stored job count for ${state}`, {
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
          // Fallback to scraping if storage operations fail
          logger.info(`Falling back to scraping for ${state}`);
          const region = STATE_ABBR_TO_NAME[state];
          stateJobCount = await searchJobsInState(browser, state, region);
        }
      } else {
        // No repository available, scrape directly
        logger.info(`No repository available, scraping ${state}`);
        const region = STATE_ABBR_TO_NAME[state];
        stateJobCount = await searchJobsInState(browser, state, region);
      }

      jobCounts[state] = stateJobCount;
      logger.info(`Completed ${state}: found ${stateJobCount} total jobs`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return jobCounts;
  } finally {
    try {
      await browser.close();
    } catch (closeError) {
      logger.warn('Failed to close browser: ', closeError);
      throw closeError;
    }
  }
}

export default scrapeAmazonJobs;
