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
