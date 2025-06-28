import { Browser } from 'puppeteer';
import { logger } from '../../util';

export async function searchJobsInState(
  browser: Browser,
  state: string,
  region: string,
): Promise<number> {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    const searchUrl = `https://www.amazon.jobs/en/search?base_query=&loc_query=${state}%2C+United+States&loc_group_id=&invalid_location=false&country=USA&city=&region=${region}&county=`;

    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    await page
      .waitForSelector('button[name="desktopFilter_job_type"]', {
        timeout: 10000,
      })
      .catch(() => {
        return;
      });

    const jobCount = await page.evaluate(() => {
      // Browser context - document is available but TypeScript doesn't know about it
      const document = (globalThis as unknown as { document: unknown })
        .document as {
        querySelector: (selector: string) => {
          querySelector: (
            selector: string,
          ) => { textContent: string | null } | null;
        } | null;
        querySelectorAll: (
          selector: string,
        ) => { getAttribute: (name: string) => string | null }[];
      };

      function getTotalJobsFromPagination(
        pageButtons: { getAttribute: (name: string) => string | null }[],
      ): number {
        if (pageButtons.length === 0) {
          return 500;
        }

        let maxPage = 1;

        pageButtons.forEach((button) => {
          const pageNumber = parseInt(
            button.getAttribute('data-label') || '1',
            10,
          );

          if (!isNaN(pageNumber) && pageNumber > maxPage) {
            maxPage = pageNumber;
          }
        });

        return maxPage * 10;
      }

      function getJobCountFromFilters(): number {
        const fullTimeButton = document.querySelector(
          'button[name="desktopFilter_job_type"][data-label="Full Time"]',
        );

        if (!fullTimeButton) {
          return 0;
        }

        const jobCountElement = fullTimeButton.querySelector('.job-count');

        if (!jobCountElement) {
          return 0;
        }

        const jobCountText = jobCountElement.textContent || '';
        const match = jobCountText.match(/\((\d+)(?:\+)?\)/);

        if (match && match[1]) {
          const count = parseInt(match[1], 10);

          if (jobCountText.includes('500+')) {
            const pageButtons = document.querySelectorAll('.page-button');
            return getTotalJobsFromPagination(Array.from(pageButtons));
          }

          return count;
        }

        return 0;
      }

      return getJobCountFromFilters();
    });

    logger.info(`Found ${jobCount} jobs in ${state}`);
    return jobCount;
  } catch (error) {
    logger.warn(`Failed to search jobs in ${state}: `, error);
    throw error;
  } finally {
    try {
      await page.close();
    } catch (closeError) {
      logger.warn(`Failed to close page for ${state}: `, closeError);
    }
  }
}

export default searchJobsInState;
