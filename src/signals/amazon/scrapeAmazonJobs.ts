import puppeteer from 'puppeteer';
import { States } from '../../types';
import { logger } from '../../util';
import { STATE_ABBR_TO_NAME } from '../../constants';
import { searchJobsInState } from './searchJobsInState';

export async function scrapeAmazonJobs(): Promise<Record<string, number>> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const jobCounts: Record<string, number> = {};

    // Initialize job count for all states
    for (const state of Object.values(States)) {
      jobCounts[state] = 0;
    }

    // Query job data per state
    for (const state of Object.values(States)) {
      logger.info(`Searching for Amazon jobs in ${state}`);

      const region = STATE_ABBR_TO_NAME[state];
      const stateJobCount = await searchJobsInState(browser, state, region);

      jobCounts[state] = stateJobCount;

      logger.info(`Completed ${state}: found ${stateJobCount} total jobs`);

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Throttle requests
    }

    return jobCounts;
  } finally {
    try {
      await browser.close();
    } catch (closeError) {
      logger.warn('Failed to close browser: ', closeError);
      throw closeError; // Ensure this is visible in tests/logs
    }
  }
}

export default scrapeAmazonJobs;
