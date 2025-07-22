export interface WalmartJobRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export interface WalmartSignalRepository<T> {
  exists(state: string, timestamp?: number): Promise<boolean>;
  get(state: string, timestamp?: number): Promise<T | null>;
  save(record: T): Promise<void>;
  query?(state: string, start?: number, end?: number): Promise<T[]>;
}

export interface WalmartSlidingWindowAggregate {
  state: string;
  windowStart: number;
  windowEnd: number;
  totalJobCount: number;
  dayCount: number;
  averageJobCount: number;
  lastUpdated: number;
}

export interface WalmartSlidingWindowRepository {
  getAggregate(state: string): Promise<WalmartSlidingWindowAggregate | null>;
  saveAggregate(aggregate: WalmartSlidingWindowAggregate): Promise<void>;
  updateAggregate(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
    oldDayTimestamp?: number,
    oldDayJobCount?: number,
  ): Promise<void>;
}
