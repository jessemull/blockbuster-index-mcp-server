export interface JobSignalRecord {
  jobCount: number;
  state: string;
  timestamp: number;
}

export interface JobSignalRepository {
  exists(state: string, timestamp?: number): Promise<boolean>;
  query(
    state: string,
    start?: number,
    end?: number,
  ): Promise<JobSignalRecord[]>;
  save(record: JobSignalRecord): Promise<void>;
  saveBatch(records: JobSignalRecord[]): Promise<void>;
}
