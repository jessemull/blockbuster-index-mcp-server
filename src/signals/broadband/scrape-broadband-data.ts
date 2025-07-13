import { logger } from '../../util/logger';
import { BrowserDocument } from '../../types/browser';

export async function scrapeBroadbandData(): Promise<void> {
  const puppeteer = await import('puppeteer');
  const fs = await import('fs');
  const path = await import('path');

  const browser = await puppeteer.default.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(
      'https://www.fcc.gov/general/broadband-deployment-data-fcc-form-477',
      {
        waitUntil: 'networkidle2',
      },
    );

    // Extract download links from the page...

    const downloadLinks = await page.evaluate(() => {
      // Find all anchor tags with Box.com download links...

      const anchorElements = (
        globalThis as unknown as { document: BrowserDocument }
      ).document.querySelectorAll('a[href*="us-fcc.box.com/v/"]');

      const links: { state: string; url: string }[] = [];
      for (const element of anchorElements) {
        const href = element.getAttribute('href');
        if (href) {
          // Extract state from href or assume text content through DOM...

          const text =
            (
              element as unknown as { textContent?: string }
            ).textContent?.trim() || '';
          const stateMatch = text.match(/^([A-Z]{2})\s/);
          if (stateMatch) {
            links.push({
              state: stateMatch[1],
              url: href,
            });
          }
        }
      }

      return links;
    });

    logger.info(`Found ${downloadLinks.length} download links`);

    // Create data directory...

    const dataDir = path.resolve(process.cwd(), 'data', 'broadband');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Download each CSV file...

    for (const { state, url } of downloadLinks) {
      try {
        logger.info(`Downloading CSV for ${state}...`);

        // Navigate to the Box.com download page...

        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for the download button and click it...

        await page.waitForSelector('button[data-testid="download-btn"]', {
          timeout: 10000,
        });

        // Enable request interception to handle the download...

        await page.setRequestInterception(true);

        page.on('request', (request) => {
          if (request.url().includes('.csv')) {
            // Handle CSV download...

            request.continue();
          } else {
            request.continue();
          }
        });

        // Click the download button...

        await page.click('button[data-testid="download-btn"]');

        // Wait a bit for the download to start...

        await new Promise((resolve) => setTimeout(resolve, 2000));

        logger.info(`Downloaded CSV for ${state}`);

        // Disable request interception for next iteration...

        await page.setRequestInterception(false);
      } catch (error) {
        logger.error(`Failed to download CSV for ${state}:`, error);
        continue;
      }
    }

    logger.info('Broadband data scraping completed');
  } catch (error) {
    logger.error('Error in scrapeBroadbandData:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
