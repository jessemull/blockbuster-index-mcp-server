// Raw CSV data structure from FCC broadband files.

export interface BroadbandCsvRecord {
  BlockCode: string;
  Business: string;
  Consumer: string;
  DBAName: string;
  FRN: string;
  HocoFinal: string;
  HocoNum: string;
  HoldingCompanyName: string;
  LogRecNo: string;
  MaxAdDown: string;
  MaxAdUp: string;
  Provider_Id: string;
  ProviderName: string;
  StateAbbr: string;
  TechCode: string;
}

export interface S3BroadbandCsvRecord {
  BlockCode?: string;
  MaxAdDown?: string;
  ProviderName?: string;
  StateAbbr?: string;
  TechCode?: string;
}

export interface BroadbandRecord {
  censusBlock: string;
  provider: string;
  speed: number;
  state: string;
  technology: string;
}

export interface S3BroadbandData {
  dataVersion: string;
  lastUpdated: Date;
  state: string;
}

export interface BroadbandMetrics {
  averageDownloadSpeed: number;
  blocksWithBroadband: number;
  blocksWithGigabit: number;
  blocksWithHighSpeed: number;
  broadbandAvailabilityPercent: number;
  broadbandScore: number;
  gigabitAvailabilityPercent: number;
  highSpeedAvailabilityPercent: number;
  medianDownloadSpeed: number;
  technologyCounts: TechnologyCounts;
  totalCensusBlocks: number;
}

export interface TechnologyCounts {
  cable: number;
  dsl: number;
  fiber: number;
  other: number;
  wireless: number;
}

export interface BroadbandSignalRecord {
  averageDownloadSpeed: number;
  blocksWithBroadband: number;
  blocksWithGigabit: number;
  blocksWithHighSpeed: number;
  broadbandAvailabilityPercent: number;
  broadbandScore: number;
  dataVersion: string;
  gigabitAvailabilityPercent: number;
  highSpeedAvailabilityPercent: number;
  medianDownloadSpeed: number;
  state: string;
  technologyCounts: TechnologyCounts;
  timestamp: number;
  totalCensusBlocks: number;
}

export interface StateVersionMetadata {
  dataVersion: string;
  lastProcessed: number;
  state: string;
}
