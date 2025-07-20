import { CONFIG } from '../../config';
import {
  WalmartSignalRepository,
  WalmartPhysicalJobRecord,
  WalmartTechnologyJobRecord,
} from '../../types/walmart';
import { calculateInvertedScores } from './calculate-inverted-scores';
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
    for (const [state, jobCount] of Object.entries(physicalJobs)) {
      await slidingWindowService.updateSlidingWindow(
        state,
        jobCount,
        timestamp * 1000, // Convert seconds to milliseconds.
      );
    }

    // Get scores from sliding window aggregates...

    const slidingWindowJobCounts =
      await slidingWindowService.getSlidingWindowScores();

    const physicalScores = calculateInvertedScores(slidingWindowJobCounts);
    const technologyScores = calculateInvertedScores(technologyJobs); // Technology jobs get positive scoring

    logger.info(
      'Walmart job presence calculation completed with sliding window...',
      {
        totalStates: Object.keys(physicalScores).length,
        totalPhysicalJobs: Object.values(slidingWindowJobCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
        totalTechnologyJobs: Object.values(technologyJobs).reduce(
          (sum, count) => sum + count,
          0,
        ),
        windowDays: 90,
      },
    );

    return {
      physicalScores,
      technologyScores,
    };
  } else {
    // Fallback to direct calculation for development without DynamoDB...

    const physicalScores = calculateInvertedScores(physicalJobs);
    const technologyScores = calculateInvertedScores(technologyJobs);

    logger.info('Walmart job presence calculation completed (fallback)...', {
      totalStates: Object.keys(physicalScores).length,
      totalPhysicalJobs: Object.values(physicalJobs).reduce(
        (sum, count) => sum + count,
        0,
      ),
      totalTechnologyJobs: Object.values(technologyJobs).reduce(
        (sum, count) => sum + count,
        0,
      ),
    });

    return {
      physicalScores,
      technologyScores,
    };
  }
};
