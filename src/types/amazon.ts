export interface JobSignalRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export interface SignalRepository<T> {
  exists(state: string, timestamp?: number): Promise<boolean>;
  save(record: T): Promise<void>;
  query?(state: string, start?: number, end?: number): Promise<T[]>;
}

export interface SlidingWindowAggregate {
  state: string;
  windowStart: number;
  windowEnd: number;
  totalJobCount: number;
  dayCount: number;
  averageJobCount: number;
  lastUpdated: number;
}

export interface SlidingWindowRepository {
  getAggregate(state: string): Promise<SlidingWindowAggregate | null>;
  saveAggregate(aggregate: SlidingWindowAggregate): Promise<void>;
  updateAggregate(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
    oldDayTimestamp?: number,
    oldDayJobCount?: number,
  ): Promise<void>;
}
