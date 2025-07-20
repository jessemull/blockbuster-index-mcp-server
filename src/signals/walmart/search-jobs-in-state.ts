import { Browser } from 'puppeteer';
import { logger } from '../../util';
import {
  WALMART_PHYSICAL_JOBS_URL_TEMPLATE,
  WALMART_TECHNOLOGY_JOBS_URL_TEMPLATE,
} from '../../constants/walmart';
import { getJobCountFromPage } from './get-job-count-from-page';

export async function searchWalmartJobsInState(
  browser: Browser,
  state: string,
  jobType: 'physical' | 'technology',
): Promise<number> {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    const urlTemplate =
      jobType === 'physical'
        ? WALMART_PHYSICAL_JOBS_URL_TEMPLATE
        : WALMART_TECHNOLOGY_JOBS_URL_TEMPLATE;

    const searchUrl = urlTemplate.replace('{STATE}', state);

    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Wait for the job count element to appear
    await page
      .waitForSelector('#count_totalResults', {
        timeout: 10000,
      })
      .catch(() => {
        logger.warn(`Job count element not found for ${state} ${jobType} jobs`);
        return;
      });

    const jobCount = await getJobCountFromPage(page);

    logger.info(`Found ${jobCount} ${jobType} jobs in ${state}`);
    return jobCount;
  } catch (error: unknown) {
    logger.warn(`Failed to search ${jobType} jobs in ${state}: `, error);
    throw error;
  } finally {
    try {
      await page.close();
    } catch (closeError) {
      logger.warn(
        `Failed to close page for ${state} ${jobType} jobs: `,
        closeError,
      );
    }
  }
}
