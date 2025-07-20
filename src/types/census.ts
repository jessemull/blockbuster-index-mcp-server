export interface CensusData {
  establishments: CensusEstablishmentData;
  population: CensusPopulationData;
  workforce: CensusWorkforceData;
  year: number;
}

export interface CensusEstablishmentData {
  [state: string]: number;
}

export interface CensusPopulationData {
  [state: string]: number;
}

export interface CensusWorkforceData {
  [state: string]: number;
}

export interface CensusSignalRecord {
  retailStores: number;
  workforce: number;
  state: string;
  timestamp: number;
}

export interface CensusSignalRepository {
  exists(state: string, timestamp?: number): Promise<boolean>;
  get(state: string, timestamp?: number): Promise<CensusSignalRecord | null>;
  getLatest(state: string): Promise<CensusSignalRecord | null>;
  save(record: CensusSignalRecord): Promise<void>;
}
