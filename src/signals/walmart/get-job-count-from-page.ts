import { Page } from 'puppeteer';
import { logger } from '../../util';
import { WALMART_JOB_COUNT_SELECTOR } from '../../constants/walmart';
import type { BrowserDocument } from '../../types/browser';

export async function getJobCountFromPage(page: Page): Promise<number> {
  try {
    const jobCount = await page.evaluate(() => {
      const document = (globalThis as unknown as { document: BrowserDocument })
        .document;

      const jobCountElement = document.querySelector(
        WALMART_JOB_COUNT_SELECTOR,
      );

      if (!jobCountElement) {
        return 0;
      }

      // Handle the nested querySelector structure...

      const textElement = jobCountElement.querySelector('span');
      if (!textElement) {
        return 0;
      }

      const jobCountText = textElement.textContent || '';
      const count = parseInt(jobCountText, 10);

      return isNaN(count) ? 0 : count;
    });

    logger.info(`Extracted job count: ${jobCount}`);
    return jobCount;
  } catch (error: unknown) {
    logger.error('Failed to extract job count from page', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
