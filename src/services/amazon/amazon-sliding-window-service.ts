import { logger } from '../../util';
import { States } from '../../types/states';
import { DynamoDBAmazonSignalRepository } from '../../repositories/amazon/amazon-signal-repository';
import { DynamoDBAmazonSlidingWindowRepository } from '../../repositories/amazon/amazon-sliding-window-repository';
import type { SlidingWindowAggregate } from '../../types/amazon';

const WINDOW_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class AmazonSlidingWindowService {
  private jobRepository: DynamoDBAmazonSignalRepository;
  private slidingWindowRepository: DynamoDBAmazonSlidingWindowRepository;

  constructor() {
    this.jobRepository = new DynamoDBAmazonSignalRepository(
      process.env.AMAZON_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-amazon-jobs-dev',
    );
    this.slidingWindowRepository = new DynamoDBAmazonSlidingWindowRepository(
      process.env.AMAZON_SLIDING_WINDOW_TABLE_NAME ||
        'blockbuster-index-amazon-sliding-window-dev',
    );
  }

  async updateSlidingWindow(
    state: string,
    newJobCount: number,
    newTimestamp: number,
  ): Promise<void> {
    try {
      logger.info('Updating sliding window for state:', {
        state,
        newJobCount,
        newTimestamp,
      });

      // Get the current sliding window aggregate
      const currentAggregate =
        await this.slidingWindowRepository.getAggregate(state);

      if (!currentAggregate) {
        // First time - create initial aggregate
        await this.slidingWindowRepository.updateAggregate(
          state,
          newJobCount,
          newTimestamp,
        );
        return;
      }

      // Calculate the window boundaries
      const windowStart = newTimestamp - WINDOW_DAYS * MILLISECONDS_PER_DAY;

      // Find the oldest day that should be removed from the window
      const oldestDayToRemove = currentAggregate.windowStart;
      let oldDayJobCount: number | undefined;

      if (oldestDayToRemove < windowStart) {
        // We need to remove the oldest day
        const oldDayRecord = await this.jobRepository.query(
          state,
          oldestDayToRemove,
          oldestDayToRemove,
        );

        if (oldDayRecord.length > 0) {
          oldDayJobCount = oldDayRecord[0].jobCount;
        }
      }

      // Update the sliding window aggregate
      await this.slidingWindowRepository.updateAggregate(
        state,
        newJobCount,
        newTimestamp,
        oldestDayToRemove < windowStart ? oldestDayToRemove : undefined,
        oldDayJobCount,
      );

      logger.info('Successfully updated sliding window:', {
        state,
        newJobCount,
        oldDayRemoved: oldestDayToRemove < windowStart,
        oldDayJobCount,
      });
    } catch (error: unknown) {
      logger.error('Failed to update sliding window', {
        error: error instanceof Error ? error.message : String(error),
        state,
        newJobCount,
        newTimestamp,
      });
      throw error;
    }
  }

  async getSlidingWindowScores(): Promise<Record<string, number>> {
    try {
      logger.info('Getting sliding window scores for all states');

      const scores: Record<string, number> = {};

      for (const state of Object.values(States)) {
        const aggregate =
          await this.slidingWindowRepository.getAggregate(state);

        if (aggregate && aggregate.dayCount > 0) {
          // Use the average job count for scoring
          scores[state] = aggregate.averageJobCount;
        } else {
          // No data available, use 0
          scores[state] = 0;
        }
      }

      logger.info('Retrieved sliding window scores:', {
        totalStates: Object.keys(scores).length,
        statesWithData: Object.values(scores).filter((score) => score > 0)
          .length,
      });

      return scores;
    } catch (error: unknown) {
      logger.error('Failed to get sliding window scores', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async initializeSlidingWindowFromHistoricalData(): Promise<void> {
    try {
      logger.info('Initializing sliding window from historical data');

      const now = Date.now();
      const windowStart = now - WINDOW_DAYS * MILLISECONDS_PER_DAY;

      for (const state of Object.values(States)) {
        logger.info(`Processing historical data for ${state}`);

        // Query all job records for this state within the window
        const jobRecords = await this.jobRepository.query(
          state,
          windowStart,
          now,
        );

        if (jobRecords.length === 0) {
          logger.info(`No historical data found for ${state}`);
          continue;
        }

        // Calculate the sliding window aggregate
        const totalJobCount = jobRecords.reduce(
          (sum, record) => sum + record.jobCount,
          0,
        );
        const dayCount = jobRecords.length;
        const averageJobCount = totalJobCount / dayCount;

        const aggregate: SlidingWindowAggregate = {
          state,
          windowStart: Math.min(...jobRecords.map((r) => r.timestamp)),
          windowEnd: Math.max(...jobRecords.map((r) => r.timestamp)),
          totalJobCount,
          dayCount,
          averageJobCount,
          lastUpdated: now,
        };

        await this.slidingWindowRepository.saveAggregate(aggregate);

        logger.info(`Initialized sliding window for ${state}`, {
          dayCount,
          averageJobCount,
          totalJobCount,
        });
      }

      logger.info('Completed sliding window initialization');
    } catch (error: unknown) {
      logger.error('Failed to initialize sliding window', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
