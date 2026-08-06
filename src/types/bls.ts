export interface BlsCsvRecord {
  agglvl_code: string;
  annual_avg_emplvl: string;
  annual_avg_estabs: string;
  annual_avg_wkly_wage: string;
  annual_contributions: string;
  area_fips: string;
  avg_annual_pay: string;
  industry_code: string;
  lq_annual_avg_emplvl: string;
  lq_annual_avg_estabs: string;
  lq_annual_avg_wkly_wage: string;
  lq_annual_contributions: string;
  lq_avg_annual_pay: string;
  lq_taxable_annual_wages: string;
  lq_total_annual_wages: string;
  oty_annual_avg_emplvl_pct: string;
  oty_annual_avg_estabs_pct: string;
  oty_total_annual_wages_pct: string;
  own_code: string;
  size_code: string;
  taxable_annual_wages: string;
  total_annual_wages: string;
  year: string;
}

export interface BlsStateData {
  brickAndMortarCodes: Record<string, number>; // Map of codes to retailLq values
  ecommerceCodes: Record<string, number>; // Map of codes to retailLq values
  state: string;
  timestamp: number;
  year: number;
}

export interface BlsProcessedFile {
  fileSize: number;
  processedAt: number;
  recordCount: number;
  year: string;
}

export interface BlsSignalRecord {
  calculatedAt: string;
  dataPoints: number;
  ecommerceScore: number; // E-commerce signal score
  ecommerceSlope: number; // E-commerce slope
  ecommerceTrend: 'declining' | 'growing' | 'stable'; // E-commerce trend
  physicalScore: number; // Brick and mortar retail signal score
  physicalSlope: number; // Brick and mortar retail slope
  physicalTrend: 'declining' | 'growing' | 'stable'; // Brick and mortar retail trend
  state: string;
  timestamp: number;
  yearsAnalyzed: number[];
}

export interface BlsRepository {
  getAllSignals(): Promise<BlsSignalRecord[]>;
  getAllStateDataForState(state: string): Promise<BlsStateData[]>;
  getAllStateDataForYear(year: number): Promise<BlsStateData[]>;
  getLatestSignal(state: string): Promise<BlsSignalRecord | null>;
  getStateData(state: string, year: number): Promise<BlsStateData | null>;
  isFileProcessed(year: string): Promise<boolean>;
  saveProcessedFile(file: BlsProcessedFile): Promise<void>;
  saveSignal(record: BlsSignalRecord): Promise<void>;
  saveStateData(data: BlsStateData): Promise<void>;
  saveStateDataBatch(dataArray: BlsStateData[]): Promise<void>;
}

export interface BlsMetrics {
  dataPoints: number;
  ecommerceScore: number; // E-commerce signal score
  ecommerceSlope: number; // E-commerce slope
  ecommerceTrend: 'declining' | 'growing' | 'stable'; // E-commerce trend
  physicalScore: number; // Brick and mortar retail signal score
  physicalSlope: number; // Brick and mortar retail slope
  physicalTrend: 'declining' | 'growing' | 'stable'; // Brick and mortar retail trend
  yearsAnalyzed: number[];
}

export interface BlsService {
  getAllEcommerceScores(): Promise<Record<string, number>>;
  getAllPhysicalScores(): Promise<Record<string, number>>;
  processBlsData(): Promise<void>;
}
