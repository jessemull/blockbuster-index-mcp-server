import puppeteer from 'puppeteer';
import { logger } from '../../util';
import { States } from '../../types';
import { searchWalmartJobsInState } from './search-jobs-in-state';
import type {
  WalmartSignalRepository,
  WalmartPhysicalJobRecord,
  WalmartTechnologyJobRecord,
} from '../../types/walmart';

export async function scrapeWalmartJobs(
  physicalRepository?: WalmartSignalRepository<WalmartPhysicalJobRecord>,
  technologyRepository?: WalmartSignalRepository<WalmartTechnologyJobRecord>,
  timestamp?: number,
): Promise<{
  physicalJobs: Record<string, number>;
  technologyJobs: Record<string, number>;
}> {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const physicalJobCounts: Record<string, number> = {};
    const technologyJobCounts: Record<string, number> = {};

    // Initialize job count for all states...

    for (const state of Object.values(States)) {
      physicalJobCounts[state] = 0;
      technologyJobCounts[state] = 0;
    }

    // Query job data per state, checking for existing data first...
    for (const state of Object.values(States)) {
      logger.info(`Processing Walmart jobs for ${state}`);

      let statePhysicalJobCount = 0;
      let stateTechnologyJobCount = 0;

      // Check if data already exists for today before scraping...

      if (physicalRepository && technologyRepository && timestamp) {
        try {
          const physicalExists = await physicalRepository.exists(
            state,
            timestamp,
          );
          const technologyExists = await technologyRepository.exists(
            state,
            timestamp,
          );

          if (physicalExists && technologyExists) {
            // Use existing data, don't scrape...

            const existingPhysicalRecord = await physicalRepository.get(
              state,
              timestamp,
            );

            const existingTechnologyRecord = await technologyRepository.get(
              state,
              timestamp,
            );

            if (existingPhysicalRecord) {
              statePhysicalJobCount = existingPhysicalRecord.jobCount;
            }

            if (existingTechnologyRecord) {
              stateTechnologyJobCount = existingTechnologyRecord.jobCount;
            }

            logger.info(
              `Using existing data for ${state}: ${statePhysicalJobCount} physical, ${stateTechnologyJobCount} technology jobs`,
              {
                state,
                physicalJobCount: statePhysicalJobCount,
                technologyJobCount: stateTechnologyJobCount,
                timestamp,
              },
            );
          } else {
            // Data doesn't exist, scrape and store...

            logger.info(`No existing data found for ${state}, scraping...`);

            statePhysicalJobCount = await searchWalmartJobsInState(
              browser,
              state,
              'physical',
            );
            stateTechnologyJobCount = await searchWalmartJobsInState(
              browser,
              state,
              'technology',
            );

            const physicalRecord: WalmartPhysicalJobRecord = {
              state,
              timestamp,
              jobCount: statePhysicalJobCount,
            };

            const technologyRecord: WalmartTechnologyJobRecord = {
              state,
              timestamp,
              jobCount: stateTechnologyJobCount,
            };

            await physicalRepository.save(physicalRecord);
            await technologyRepository.save(technologyRecord);

            logger.info(`Stored job counts for ${state}`, {
              state,
              physicalJobCount: statePhysicalJobCount,
              technologyJobCount: stateTechnologyJobCount,
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
          statePhysicalJobCount = await searchWalmartJobsInState(
            browser,
            state,
            'physical',
          );
          stateTechnologyJobCount = await searchWalmartJobsInState(
            browser,
            state,
            'technology',
          );
        }
      } else {
        // No repository available, scrape directly...

        logger.info(`No repository available, scraping ${state}`);
        statePhysicalJobCount = await searchWalmartJobsInState(
          browser,
          state,
          'physical',
        );
        stateTechnologyJobCount = await searchWalmartJobsInState(
          browser,
          state,
          'technology',
        );
      }

      physicalJobCounts[state] = statePhysicalJobCount;
      technologyJobCounts[state] = stateTechnologyJobCount;

      logger.info(
        `Completed ${state}: found ${statePhysicalJobCount} physical, ${stateTechnologyJobCount} technology jobs`,
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return {
      physicalJobs: physicalJobCounts,
      technologyJobs: technologyJobCounts,
    };
  } finally {
    try {
      await browser.close();
    } catch (closeError) {
      logger.warn('Failed to close browser: ', closeError);
      throw closeError;
    }
  }
}

export default scrapeWalmartJobs;
