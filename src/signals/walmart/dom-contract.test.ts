import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { WALMART_JOB_COUNT_SELECTOR } from '../../constants/walmart';

/**
 * Contract tests: fixture HTML must keep Walmart careers selectors the scrape
 * depends on. Refresh the fixture when production scrapes break due to DOM drift.
 */
describe('Walmart jobs search DOM contract', () => {
  const fixturePath = path.join(
    __dirname,
    '__fixtures__',
    'jobs-search-snippet.html',
  );
  const html = fs.readFileSync(fixturePath, 'utf8');
  const $ = cheerio.load(html);

  it('exposes the job count selector used by getJobCountFromPage', () => {
    const element = $(WALMART_JOB_COUNT_SELECTOR);
    expect(element.length).toBe(1);
    expect(WALMART_JOB_COUNT_SELECTOR).toBe('#count_totalResults');
  });

  it('parses job count text the same way page.evaluate does', () => {
    const text = $(WALMART_JOB_COUNT_SELECTOR).text() || '';
    const count = parseInt(text.replace(/\D/g, ''), 10);
    expect(count).toBe(1234);
  });
});
