export interface BlsCsvRecord {
  area_fips: string;
  industry_code: string;
  own_code: string;
  agglvl_code: string;
  size_code: string;
  year: string;
  annual_avg_emplvl: string;
  annual_avg_estabs: string;
  total_annual_wages: string;
  taxable_annual_wages: string;
  annual_contributions: string;
  annual_avg_wkly_wage: string;
  avg_annual_pay: string;
  lq_annual_avg_emplvl: string;
  lq_annual_avg_estabs: string;
  lq_total_annual_wages: string;
  lq_taxable_annual_wages: string;
  lq_annual_contributions: string;
  lq_annual_avg_wkly_wage: string;
  lq_avg_annual_pay: string;
  oty_total_annual_wages_pct: string;
  oty_annual_avg_emplvl_pct: string;
  oty_annual_avg_estabs_pct: string;
}

export interface BlsStateData {
  state: string;
  year: number;
  retailLq: number;
  timestamp: number;
}

export interface BlsProcessedFile {
  year: string;
  processedAt: number;
  fileSize: number;
  recordCount: number;
}

export interface BlsSignalRecord {
  state: string;
  timestamp: number;
  calculatedAt: string;
  retailLqSlope: number;
  retailLqTrend: 'declining' | 'stable' | 'growing';
  blockbusterScore: number;
  dataPoints: number;
  yearsAnalyzed: number[];
}

export interface BlsRepository {
  saveProcessedFile(file: BlsProcessedFile): Promise<void>;
  isFileProcessed(year: string): Promise<boolean>;
  saveStateData(data: BlsStateData): Promise<void>;
  getStateData(state: string, year: number): Promise<BlsStateData | null>;
  getAllStateDataForYear(year: number): Promise<BlsStateData[]>;
  saveSignal(record: BlsSignalRecord): Promise<void>;
  getLatestSignal(state: string): Promise<BlsSignalRecord | null>;
  getAllSignals(): Promise<BlsSignalRecord[]>;
}

export interface BlsMetrics {
  retailLqSlope: number;
  retailLqTrend: 'declining' | 'stable' | 'growing';
  blockbusterScore: number;
  dataPoints: number;
  yearsAnalyzed: number[];
}

export interface BlsService {
  processBlsData(): Promise<void>;
  calculateStateMetrics(state: string): Promise<BlsMetrics | null>;
  getAllScores(): Promise<Record<string, number>>;
}
