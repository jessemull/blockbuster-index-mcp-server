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

// Technology categories for grouping FCC tech codes.

export interface TechnologyCounts {
  fiber: number; // Tech codes 70, 30
  cable: number; // Tech codes 60, 20
  dsl: number; // Tech codes 10, 11
  wireless: number; // Tech codes 40, 41, 42
  other: number; // Tech codes 12, 43, 50
}

// Processed broadband metrics for a state.

export interface BroadbandMetrics {
  totalCensusBlocks: number;
  blocksWithBroadband: number;
  broadbandAvailabilityPercent: number;

  blocksWithHighSpeed: number; // 25+ Mbps.
  highSpeedAvailabilityPercent: number;
  blocksWithGigabit: number; // 1000+ Mbps.
  gigabitAvailabilityPercent: number;

  technologyCounts: TechnologyCounts;

  averageDownloadSpeed: number;
  medianDownloadSpeed: number;

  broadbandScore: number;
}

// DynamoDB record structure.

export interface BroadbandSignalRecord extends BroadbandMetrics {
  state: string;
  timestamp: number;
  dataVersion?: string; // FCC data version (e.g., "Dec 21v1")
}
