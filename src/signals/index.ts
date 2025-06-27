import {
  calculateScores,
  getAmazonScores,
  getEqualScores,
  getJobCountFromFilters,
  getTotalJobsFromPagination,
  scrapeAmazonJobs,
  searchJobsInState,
} from './amazon';
import { getAnalogScores } from './analog';
import { getBroadbandScores } from './broadband';
import { getCommerceScores } from './ecommerce';
import { getPhysicalScores } from './physical';
import { getStreamingScores } from './streaming';
import { getWalmartScores } from './walmart';

export {
  calculateScores,
  getAmazonScores,
  getAnalogScores,
  getBroadbandScores,
  getCommerceScores,
  getEqualScores,
  getJobCountFromFilters,
  getPhysicalScores,
  getStreamingScores,
  getTotalJobsFromPagination,
  getWalmartScores,
  scrapeAmazonJobs,
  searchJobsInState,
};
