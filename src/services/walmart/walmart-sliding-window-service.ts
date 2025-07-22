import { logger } from '../../util';
import { States } from '../../types';
import { DynamoDBWalmartSlidingWindowRepository } from '../../repositories/walmart';
import { DynamoDBWalmartJobRepository } from '../../repositories/walmart/walmart-physical-repository';

const WINDOW_SIZE_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class WalmartSlidingWindowService {
  private repository: DynamoDBWalmartSlidingWindowRepository;
  private jobRepository: DynamoDBWalmartJobRepository;

  constructor() {
    this.repository = new DynamoDBWalmartSlidingWindowRepository(
      process.env.WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-walmart-sliding-window-dev',
    );
    this.jobRepository = new DynamoDBWalmartJobRepository(
      process.env.WALMART_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-walmart-jobs-dev',
    );
  }

  async updateSlidingWindow(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
  ): Promise<void> {
    try {
      const currentAggregate = await this.repository.getAggregate(state);

      // First time creating aggregate...
      if (!currentAggregate) {
        const newAggregate = {
          state,
          windowStart: newDayTimestamp,
          windowEnd: newDayTimestamp,
          totalJobCount: newDayJobCount,
          dayCount: 1,
          averageJobCount: newDayJobCount,
          lastUpdated: Date.now(),
        };
        await this.repository.saveAggregate(newAggregate);
        return;
      }

      // Update existing aggregate...
      let newTotalJobCount = currentAggregate.totalJobCount + newDayJobCount;
      let newDayCount = currentAggregate.dayCount + 1;
      let newWindowStart = currentAggregate.windowStart;

      // Check if we need to remove old data (sliding window)...
      const windowStartTime =
        newDayTimestamp - WINDOW_SIZE_DAYS * MILLISECONDS_PER_DAY;

      if (currentAggregate.windowStart < windowStartTime) {
        // We need to remove old data...
        const oldDayTimestamp = currentAggregate.windowStart;
        const oldDayJobCount = await this.getOldDayJobCount(
          state,
          oldDayTimestamp,
        );
        if (oldDayJobCount !== undefined) {
          newTotalJobCount -= oldDayJobCount;
          newDayCount -= 1;
          newWindowStart = oldDayTimestamp + MILLISECONDS_PER_DAY;
        }
      }

      // Ensure we dont go below 1...
      newDayCount = Math.max(1, newDayCount);
      const newAverageJobCount = newTotalJobCount / newDayCount;

      // Only pass oldDayTimestamp and oldDayJobCount if newWindowStart !== currentAggregate.windowStart and oldDayJobCount is not undefined...
      if (newWindowStart !== currentAggregate.windowStart) {
        const oldDayTimestamp = currentAggregate.windowStart;
        const oldDayJobCount = await this.getOldDayJobCount(
          state,
          oldDayTimestamp,
        );
        await this.repository.updateAggregate(
          state,
          newDayJobCount,
          newDayTimestamp,
          oldDayTimestamp,
          oldDayJobCount,
        );
      } else {
        await this.repository.updateAggregate(
          state,
          newDayJobCount,
          newDayTimestamp,
          undefined,
          undefined,
        );
      }

      logger.info('Successfully updated Walmart sliding window:', {
        state,
        newDayCount,
        newAverageJobCount,
        oldDayRemoved: newWindowStart !== currentAggregate.windowStart,
      });
    } catch (error: unknown) {
      logger.error('Failed to update Walmart sliding window', {
        error: error instanceof Error ? error.message : String(error),
        state,
        newDayJobCount,
        newDayTimestamp,
      });
      throw error;
    }
  }

  async getSlidingWindowScores(): Promise<Record<string, number>> {
    try {
      const scores: Record<string, number> = {};
      for (const state of Object.values(States)) {
        const aggregate = await this.repository.getAggregate(state);
        if (aggregate) {
          scores[state] = Math.round(aggregate.averageJobCount);
        } else {
          scores[state] = 0;
        }
      }
      return scores;
    } catch (error: unknown) {
      logger.error('Failed to get Walmart sliding window scores', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // This fetches the job count for the old day from the Walmart jobs table.
  private async getOldDayJobCount(
    state: string,
    timestamp: number,
  ): Promise<number | undefined> {
    try {
      const record = await this.jobRepository.get(state, timestamp);
      if (record && typeof record.jobCount === 'number') {
        return record.jobCount;
      }
      return undefined;
    } catch (error: unknown) {
      logger.warn('Failed to get old day job count', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      return undefined;
    }
  }
}
