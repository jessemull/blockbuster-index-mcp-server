import { calculateScores } from './calculateScores';
import { getAmazonScores } from './getAmazonScores';
import { getEqualScores } from './getEqualScores';
import { getJobCountFromFilters } from './getJobCountFromFilters';
import { getTotalJobsFromPagination } from './getTotalJobsFromPagination';
import { scrapeAmazonJobs } from './scrapeAmazonJobs';
import { searchJobsInState } from './searchJobsInState';

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
