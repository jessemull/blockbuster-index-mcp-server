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

    // Query job data per state and store immediately if repository is provided...

    for (const state of Object.values(States)) {
      logger.info(`Searching for Amazon jobs in ${state}`);

      const region = STATE_ABBR_TO_NAME[state];
      const stateJobCount = await searchJobsInState(browser, state, region);

      jobCounts[state] = stateJobCount;

      // Store the data immediately if repository is provided...

      if (repository && timestamp) {
        try {
          // Check if record already exists for today...

          const exists = await repository.exists(state, timestamp);

          if (!exists) {
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
          } else {
            logger.info(
              `Record already exists for ${state} today, skipping storage`,
              {
                state,
                timestamp,
              },
            );
          }
        } catch (storageError) {
          logger.error(`Failed to store job count for ${state}`, {
            state,
            jobCount: stateJobCount,
            error: storageError,
            timestamp,
          });
        }
      }

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
