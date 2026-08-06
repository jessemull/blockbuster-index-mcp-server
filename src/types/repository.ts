export interface SignalRepository<T> {
  exists(state: string, timestamp?: number): Promise<boolean>;
  get(state: string, timestamp?: number): Promise<null | T>;
  query?(state: string, start?: number, end?: number): Promise<T[]>;
  save(record: T): Promise<void>;
}
