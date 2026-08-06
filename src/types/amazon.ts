export interface JobSignalRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export interface SignalRepository<T> {
  exists(state: string, timestamp?: number): Promise<boolean>;
  get(state: string, timestamp?: number): Promise<null | T>;
  query?(state: string, start?: number, end?: number): Promise<T[]>;
  save(record: T): Promise<void>;
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
