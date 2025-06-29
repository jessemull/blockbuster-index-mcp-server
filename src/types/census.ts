export interface CensusData {
  establishments: CensusEstablishmentData;
  population: CensusPopulationData;
  year: number;
}

export interface CensusEstablishmentData {
  [state: string]: number;
}

export interface CensusPopulationData {
  [state: string]: number;
}

export interface CensusSignalRecord {
  retailStores: number;
  state: string;
  timestamp: number;
}
