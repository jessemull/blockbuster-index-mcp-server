export interface JobSignalRecord {
  state: string;
  timestamp: number;
  jobCount: number;
}

export interface JobSignalRepository {
  save(record: JobSignalRecord): Promise<void>;
  saveBatch(records: JobSignalRecord[]): Promise<void>;
  query(
    state: string,
    start?: number,
    end?: number,
  ): Promise<JobSignalRecord[]>;
  exists(state: string, timestamp?: number): Promise<boolean>;
}
