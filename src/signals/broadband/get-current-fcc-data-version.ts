import { getFirstLink } from './get-first-link';

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

    const version = await page.evaluate(getFirstLink);

    return version;
  } finally {
    await browser.close();
  }
}
