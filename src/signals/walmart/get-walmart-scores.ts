import { CONFIG } from '../../config';
import {
  WalmartSignalRepository,
  WalmartPhysicalJobRecord,
  WalmartTechnologyJobRecord,
} from '../../types/walmart';
import { calculateWorkforceNormalizedInvertedScores } from './calculate-workforce-normalized-inverted-scores';
import { calculateWorkforceNormalizedPositiveScores } from './calculate-workforce-normalized-positive-scores';
import { getWorkforceData } from '../amazon/get-workforce-data';
import { scrapeWalmartJobs } from './scrape-walmart-jobs';
import { logger } from '../../util';
import { WalmartSlidingWindowService } from '../../services/walmart/walmart-sliding-window-service';

const DEFAULT_PHYSICAL_TABLE = 'blockbuster-index-walmart-physical-jobs-dev';
const DEFAULT_TECHNOLOGY_TABLE =
  'blockbuster-index-walmart-technology-jobs-dev';

function getStartOfDayTimestamp(date: Date = new Date()): number {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds.
}

export const getWalmartScores = async (): Promise<{
  physicalScores: Record<string, number>;
  technologyScores: Record<string, number>;
}> => {
  logger.info(
    'Starting Walmart job presence calculation with sliding window...',
  );

  const timestamp = getStartOfDayTimestamp();

  let physicalRepository:
    | WalmartSignalRepository<WalmartPhysicalJobRecord>
    | undefined = undefined;
  let technologyRepository:
    | WalmartSignalRepository<WalmartTechnologyJobRecord>
    | undefined = undefined;
  let slidingWindowService: WalmartSlidingWindowService | undefined = undefined;

  if (
    !CONFIG.IS_DEVELOPMENT ||
    process.env.WALMART_PHYSICAL_DYNAMODB_TABLE_NAME
  ) {
    const {
      DynamoDBWalmartPhysicalRepository,
      DynamoDBWalmartTechnologyRepository,
    } = await import('../../repositories');
    physicalRepository = new DynamoDBWalmartPhysicalRepository(
      process.env.WALMART_PHYSICAL_DYNAMODB_TABLE_NAME ||
        DEFAULT_PHYSICAL_TABLE,
    );
    technologyRepository = new DynamoDBWalmartTechnologyRepository(
      process.env.WALMART_TECHNOLOGY_DYNAMODB_TABLE_NAME ||
        DEFAULT_TECHNOLOGY_TABLE,
    );
    slidingWindowService = new WalmartSlidingWindowService();
  }

  // Get current day job counts and store them...

  const { physicalJobs, technologyJobs } = await scrapeWalmartJobs(
    physicalRepository,
    technologyRepository,
    timestamp,
  );

  // Update sliding window aggregates with new data...

  if (slidingWindowService) {
    // Update physical sliding window
    for (const [state, jobCount] of Object.entries(physicalJobs)) {
      await slidingWindowService.updateSlidingWindow(
        state,
        'physical',
        jobCount,
        timestamp * 1000, // Convert seconds to milliseconds.
      );
    }

    // Update technology sliding window
    for (const [state, jobCount] of Object.entries(technologyJobs)) {
      await slidingWindowService.updateSlidingWindow(
        state,
        'technology',
        jobCount,
        timestamp * 1000, // Convert seconds to milliseconds.
      );
    }

    // Get workforce data for normalization
    const workforceData = await getWorkforceData();

    // Get scores from sliding window aggregates with workforce normalization...

    const physicalSlidingWindowJobCounts =
      await slidingWindowService.getSlidingWindowScores('physical');
    const technologySlidingWindowJobCounts =
      await slidingWindowService.getSlidingWindowScores('technology');

    const physicalScores = calculateWorkforceNormalizedInvertedScores(
      physicalSlidingWindowJobCounts,
      workforceData,
    );
    const technologyScores = calculateWorkforceNormalizedPositiveScores(
      technologySlidingWindowJobCounts,
      workforceData,
    ); // Technology jobs get positive scoring

    logger.info(
      'Walmart job presence calculation completed with sliding window and workforce normalization...',
      {
        totalStates: Object.keys(physicalScores).length,
        totalPhysicalJobs: Object.values(physicalSlidingWindowJobCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
        totalTechnologyJobs: Object.values(
          technologySlidingWindowJobCounts,
        ).reduce((sum, count) => sum + count, 0),
        windowDays: 90,
      },
    );

    return {
      physicalScores,
      technologyScores,
    };
  } else {
    // Fallback to workforce-normalized calculation for development without DynamoDB...

    const workforceData = await getWorkforceData();
    const physicalScores = calculateWorkforceNormalizedInvertedScores(
      physicalJobs,
      workforceData,
    );
    const technologyScores = calculateWorkforceNormalizedPositiveScores(
      technologyJobs,
      workforceData,
    );

    logger.info(
      'Walmart job presence calculation completed with workforce normalization (fallback)...',
      {
        totalStates: Object.keys(physicalScores).length,
        totalPhysicalJobs: Object.values(physicalJobs).reduce(
          (sum, count) => sum + count,
          0,
        ),
        totalTechnologyJobs: Object.values(technologyJobs).reduce(
          (sum, count) => sum + count,
          0,
        ),
      },
    );

    return {
      physicalScores,
      technologyScores,
    };
  }
};
