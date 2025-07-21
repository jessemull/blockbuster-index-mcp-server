import { Page } from 'puppeteer';
import { logger } from '../../util';
import { WALMART_JOB_COUNT_SELECTOR } from '../../constants/walmart';

export async function getJobCountFromPage(page: Page): Promise<number> {
  try {
    // Wait for dynamic content to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get job count using the selector from constants
    const jobCount = await page.evaluate((selector) => {
      // @ts-expect-error - document is available in browser context
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || '';
        const count = parseInt(text.replace(/\D/g, ''), 10);
        return isNaN(count) ? 0 : count;
      }
      return 0;
    }, WALMART_JOB_COUNT_SELECTOR);

    return jobCount;
  } catch (error: unknown) {
    logger.error('Failed to get job count from page', { error });
    return 0;
  }
}
