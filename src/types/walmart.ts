import type { SignalRepository } from './repository';

export interface WalmartJobRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export type WalmartSignalRepository<T> = SignalRepository<T>;

export interface WalmartSlidingWindowAggregate {
  averageJobCount: number;
  dayCount: number;
  lastUpdated: number;
  state: string;
  totalJobCount: number;
  windowEnd: number;
  windowStart: number;
}

export interface WalmartSlidingWindowRepository {
  getAggregate(state: string): Promise<null | WalmartSlidingWindowAggregate>;
  saveAggregate(aggregate: WalmartSlidingWindowAggregate): Promise<void>;
  updateAggregate(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
    oldDayTimestamp?: number,
    oldDayJobCount?: number,
  ): Promise<void>;
}
