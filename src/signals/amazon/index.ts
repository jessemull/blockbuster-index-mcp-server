import { calculateScores } from './calculate-scores';
import { getAmazonScores } from './get-amazon-scores';
import { getEqualScores } from './get-equal-scores';
import { getJobCountFromFilters } from './get-job-count-from-filters';
import { getTotalJobsFromPagination } from './get-total-jobs-from-pagination';
import { scrapeAmazonJobs } from './scrape-amazon-jobs';
import { searchJobsInState } from './search-jobs-in-state';

export {
  calculateScores,
  getAmazonScores,
  getEqualScores,
  getJobCountFromFilters,
  getTotalJobsFromPagination,
  scrapeAmazonJobs,
  searchJobsInState,
};

// Default export for easier importing
export default {
  calculateScores,
  getAmazonScores,
  getEqualScores,
  getJobCountFromFilters,
  getTotalJobsFromPagination,
  scrapeAmazonJobs,
  searchJobsInState,
};
