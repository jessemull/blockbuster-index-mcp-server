import { logger } from '../../util';

export class SlidingWindowService<
  TAggregate extends {
    state: string;
    windowStart: number;
    totalJobCount: number;
    dayCount: number;
    averageJobCount: number;
    windowEnd: number;
    lastUpdated: number;
  },
> {
  windowRepository: {
    getAggregate: (state: string) => Promise<TAggregate | null>;
    saveAggregate: (aggregate: TAggregate) => Promise<void>;
    updateAggregate: (
      state: string,
      newDayJobCount: number,
      newDayTimestamp: number,
      oldDayTimestamp?: number,
      oldDayJobCount?: number,
    ) => Promise<void>;
  };
  jobRepository: unknown;
  getOldDayJobCount: (
    state: string,
    timestamp: number,
  ) => Promise<number | undefined>;
  states: string[];

  constructor({
    windowRepository,
    jobRepository,
    getOldDayJobCount,
    states,
  }: {
    windowRepository: {
      getAggregate: (state: string) => Promise<TAggregate | null>;
      saveAggregate: (aggregate: TAggregate) => Promise<void>;
      updateAggregate: (
        state: string,
        newDayJobCount: number,
        newDayTimestamp: number,
        oldDayTimestamp?: number,
        oldDayJobCount?: number,
      ) => Promise<void>;
    };
    jobRepository: unknown;
    getOldDayJobCount: (
      state: string,
      timestamp: number,
    ) => Promise<number | undefined>;
    states: string[];
  }) {
    this.windowRepository = windowRepository;
    this.jobRepository = jobRepository;
    this.getOldDayJobCount = getOldDayJobCount;
    this.states = states;
  }

  async updateSlidingWindow(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
  ): Promise<void> {
    try {
      const currentAggregate = await this.windowRepository.getAggregate(state);
      if (!currentAggregate) {
        const newAggregate = {
          state,
          windowStart: newDayTimestamp,
          windowEnd: newDayTimestamp,
          totalJobCount: newDayJobCount,
          dayCount: 1,
          averageJobCount: newDayJobCount,
          lastUpdated: Date.now(),
        } as TAggregate;
        await this.windowRepository.saveAggregate(newAggregate);
        return;
      }
      let newTotalJobCount = currentAggregate.totalJobCount + newDayJobCount;
      let newDayCount = currentAggregate.dayCount + 1;
      let newWindowStart = currentAggregate.windowStart;
      const WINDOW_SIZE_DAYS = 90;
      const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
      const windowStartTime =
        newDayTimestamp - WINDOW_SIZE_DAYS * MILLISECONDS_PER_DAY;
      if (currentAggregate.windowStart < windowStartTime) {
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
      newDayCount = Math.max(1, newDayCount);
      const newAverageJobCount = newTotalJobCount / newDayCount;
      if (newWindowStart !== currentAggregate.windowStart) {
        const oldDayTimestamp = currentAggregate.windowStart;
        const oldDayJobCount = await this.getOldDayJobCount(
          state,
          oldDayTimestamp,
        );
        await this.windowRepository.updateAggregate(
          state,
          newDayJobCount,
          newDayTimestamp,
          oldDayTimestamp,
          oldDayJobCount,
        );
      } else {
        await this.windowRepository.updateAggregate(
          state,
          newDayJobCount,
          newDayTimestamp,
          undefined,
          undefined,
        );
      }
      logger.info('Successfully updated sliding window:', {
        state,
        newDayCount,
        newAverageJobCount,
        oldDayRemoved: newWindowStart !== currentAggregate.windowStart,
      });
    } catch (error: unknown) {
      logger.error('Failed to update sliding window', {
        error:
          error instanceof Error ? (error as Error).message : String(error),
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
      for (const state of this.states) {
        const aggregate = await this.windowRepository.getAggregate(state);
        if (aggregate) {
          scores[state] = Math.round(aggregate.averageJobCount);
        } else {
          scores[state] = 0;
        }
      }
      return scores;
    } catch (error: unknown) {
      logger.error('Failed to get sliding window scores', {
        error:
          error instanceof Error ? (error as Error).message : String(error),
      });
      throw error;
    }
  }
}
