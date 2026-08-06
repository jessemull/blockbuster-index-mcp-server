export interface WalmartJobRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export interface WalmartSignalRepository<T> {
  exists(state: string, timestamp?: number): Promise<boolean>;
  get(state: string, timestamp?: number): Promise<null | T>;
  query?(state: string, start?: number, end?: number): Promise<T[]>;
  save(record: T): Promise<void>;
}

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
