export interface JobSignalRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export interface SlidingWindowAggregate {
  averageJobCount: number;
  dayCount: number;
  lastUpdated: number;
  state: string;
  totalJobCount: number;
  windowEnd: number;
  windowStart: number;
}

export interface SlidingWindowRepository {
  getAggregate(state: string): Promise<null | SlidingWindowAggregate>;
  saveAggregate(aggregate: SlidingWindowAggregate): Promise<void>;
  updateAggregate(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
    oldDayTimestamp?: number,
    oldDayJobCount?: number,
  ): Promise<void>;
}
