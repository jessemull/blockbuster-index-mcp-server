import { logger } from '../../util/logger';
import { extractDownloadLinks } from './extract-download-links';
import { createPageEvaluateCallback } from './page-evaluate-callback';
import { createRequestInterceptionHandler } from './request-interception-handler';

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

    const pageEvaluateCallback =
      createPageEvaluateCallback(extractDownloadLinks);
    const downloadLinks = await page.evaluate(pageEvaluateCallback);

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

        const requestHandler = createRequestInterceptionHandler();
        page.on('request', requestHandler);

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
