import { logger } from '../../util';
import { States } from '../../types';
import type {
  WalmartSlidingWindowAggregate,
  WalmartSlidingWindowRepository,
} from '../../types/walmart';
import { DynamoDBWalmartSlidingWindowRepository } from '../../repositories/walmart';

const WINDOW_SIZE_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class WalmartSlidingWindowService {
  private repository: WalmartSlidingWindowRepository;

  constructor() {
    this.repository = new DynamoDBWalmartSlidingWindowRepository(
      process.env.WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-walmart-sliding-window-dev',
    );
  }

  async updateSlidingWindow(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
  ): Promise<void> {
    try {
      const currentAggregate = await this.repository.getAggregate(state);

      if (!currentAggregate) {
        // First time creating aggregate...

        const newAggregate: WalmartSlidingWindowAggregate = {
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

      await this.repository.updateAggregate(
        state,
        newDayJobCount,
        newDayTimestamp,
        newWindowStart !== currentAggregate.windowStart
          ? currentAggregate.windowStart
          : undefined,
        newWindowStart !== currentAggregate.windowStart
          ? await this.getOldDayJobCount(state, currentAggregate.windowStart)
          : undefined,
      );

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

  private async getOldDayJobCount(
    state: string,
    timestamp: number,
  ): Promise<number | undefined> {
    try {
      // This would need to query the daily job records. For now, we'll return undefined to indicate no old data...
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
