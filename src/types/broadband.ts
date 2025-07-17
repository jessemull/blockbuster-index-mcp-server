// Raw CSV data structure from FCC broadband files.

export interface BroadbandCsvRecord {
  LogRecNo: string;
  Provider_Id: string;
  FRN: string;
  ProviderName: string;
  DBAName: string;
  HoldingCompanyName: string;
  HocoNum: string;
  HocoFinal: string;
  StateAbbr: string;
  BlockCode: string;
  TechCode: string;
  Consumer: string;
  MaxAdDown: string;
  MaxAdUp: string;
  Business: string;
}

export interface S3BroadbandCsvRecord {
  StateAbbr?: string;
  BlockCode?: string;
  ProviderName?: string;
  TechCode?: string;
  MaxAdDown?: string;
}

export interface BroadbandRecord {
  state: string;
  censusBlock: string;
  provider: string;
  technology: string;
  speed: number;
}

export interface S3BroadbandData {
  state: string;
  dataVersion: string;
  lastUpdated: Date;
}

export interface BroadbandMetrics {
  totalCensusBlocks: number;
  blocksWithBroadband: number;
  broadbandAvailabilityPercent: number;
  blocksWithHighSpeed: number;
  highSpeedAvailabilityPercent: number;
  blocksWithGigabit: number;
  gigabitAvailabilityPercent: number;
  technologyCounts: TechnologyCounts;
  averageDownloadSpeed: number;
  medianDownloadSpeed: number;
  broadbandScore: number;
}

export interface TechnologyCounts {
  fiber: number;
  cable: number;
  dsl: number;
  wireless: number;
  other: number;
}

export interface BroadbandSignalRecord {
  state: string;
  timestamp: number;
  dataVersion: string;
  totalCensusBlocks: number;
  blocksWithBroadband: number;
  broadbandAvailabilityPercent: number;
  blocksWithHighSpeed: number;
  highSpeedAvailabilityPercent: number;
  blocksWithGigabit: number;
  gigabitAvailabilityPercent: number;
  technologyCounts: TechnologyCounts;
  averageDownloadSpeed: number;
  medianDownloadSpeed: number;
  broadbandScore: number;
}

export interface StateVersionMetadata {
  state: string;
  dataVersion: string;
  lastProcessed: number;
}
