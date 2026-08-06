import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { getJobCountFromFilters } from './get-job-count-from-filters';
import { getTotalJobsFromPagination } from './get-total-jobs-from-pagination';

/**
 * Contract tests: fixture HTML must keep Amazon careers selectors the scrape
 * depends on. Refresh the fixture when production scrapes break due to DOM drift.
 */
describe('Amazon jobs search DOM contract', () => {
  const fixturePath = path.join(
    __dirname,
    '__fixtures__',
    'jobs-search-snippet.html',
  );
  const html = fs.readFileSync(fixturePath, 'utf8');
  const $ = cheerio.load(html);

  it('includes Full Time job type filter with job-count', () => {
    const fullTime = $(
      'button[name="desktopFilter_job_type"][data-label="Full Time"]',
    );
    expect(fullTime.length).toBe(1);
    expect(fullTime.find('.job-count').text()).toContain('(150)');
  });

  it('includes pagination page-buttons with data-label', () => {
    const buttons = $('.page-button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons.last().attr('data-label')).toBe('15');
  });

  it('parses Full Time count via getJobCountFromFilters', () => {
    const fullTimeEl = $(
      'button[name="desktopFilter_job_type"][data-label="Full Time"]',
    ).get(0);
    const jobCountSpan = $(fullTimeEl!).find('.job-count').get(0);
    const buttonWithCount = {
      querySelector: (selector: string) => {
        if (selector !== '.job-count') return null;
        return { textContent: $(jobCountSpan!).text() };
      },
    };

    expect(getJobCountFromFilters(buttonWithCount, () => 0)).toBe(150);
  });

  it('parses pagination via getTotalJobsFromPagination', () => {
    const pageButtons = $('.page-button')
      .toArray()
      .map((el) => ({
        getAttribute: (name: string) => $(el).attr(name) ?? null,
      }));

    expect(getTotalJobsFromPagination(pageButtons)).toBe(150);
  });
});
