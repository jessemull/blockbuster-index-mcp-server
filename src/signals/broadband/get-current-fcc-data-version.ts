import { BrowserDocument } from '../../types/browser';

export async function getCurrentFccDataVersion(): Promise<string> {
  const puppeteer = await import('puppeteer');
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

    const version = await page.evaluate(() => {
      const firstLink = (
        globalThis as unknown as { document: BrowserDocument }
      ).document.querySelector('div.field-item.even a');
      if (firstLink) {
        const text = firstLink.querySelector('*')?.textContent?.trim();
        const versionMatch = text?.match(/- ([\w\s\d]+)$/);
        return versionMatch ? versionMatch[1].trim() : 'unknown';
      }
      return 'unknown';
    });

    return version;
  } finally {
    await browser.close();
  }
}
