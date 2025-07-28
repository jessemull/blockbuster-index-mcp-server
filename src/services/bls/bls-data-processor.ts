import { logger } from '../../util';
import type { BlsCsvRecord, BlsStateData } from '../../types/bls';

// State FIPS codes for state-level data (ending in 000)
const STATE_FIPS_CODES: Record<string, string> = {
  '01000': 'AL', // Alabama
  '02000': 'AK', // Alaska
  '04000': 'AZ', // Arizona
  '05000': 'AR', // Arkansas
  '06000': 'CA', // California
  '08000': 'CO', // Colorado
  '09000': 'CT', // Connecticut
  '10000': 'DE', // Delaware
  '11000': 'DC', // District of Columbia
  '12000': 'FL', // Florida
  '13000': 'GA', // Georgia
  '15000': 'HI', // Hawaii
  '16000': 'ID', // Idaho
  '17000': 'IL', // Illinois
  '18000': 'IN', // Indiana
  '19000': 'IA', // Iowa
  '20000': 'KS', // Kansas
  '21000': 'KY', // Kentucky
  '22000': 'LA', // Louisiana
  '23000': 'ME', // Maine
  '24000': 'MD', // Maryland
  '25000': 'MA', // Massachusetts
  '26000': 'MI', // Michigan
  '27000': 'MN', // Minnesota
  '28000': 'MS', // Mississippi
  '29000': 'MO', // Missouri
  '30000': 'MT', // Montana
  '31000': 'NE', // Nebraska
  '32000': 'NV', // Nevada
  '33000': 'NH', // New Hampshire
  '34000': 'NJ', // New Jersey
  '35000': 'NM', // New Mexico
  '36000': 'NY', // New York
  '37000': 'NC', // North Carolina
  '38000': 'ND', // North Dakota
  '39000': 'OH', // Ohio
  '40000': 'OK', // Oklahoma
  '41000': 'OR', // Oregon
  '42000': 'PA', // Pennsylvania
  '44000': 'RI', // Rhode Island
  '45000': 'SC', // South Carolina
  '46000': 'SD', // South Dakota
  '47000': 'TN', // Tennessee
  '48000': 'TX', // Texas
  '49000': 'UT', // Utah
  '50000': 'VT', // Vermont
  '51000': 'VA', // Virginia
  '53000': 'WA', // Washington
  '54000': 'WV', // West Virginia
  '55000': 'WI', // Wisconsin
  '56000': 'WY', // Wyoming
};

// Retail trade industry codes (NAICS 44-45)
const RETAIL_INDUSTRY_CODES = ['44-45', '44', '45'];

export function extractRetailDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  logger.info(
    `Extracting retail data from ${records.length} records for year ${year}`,
  );

  const stateData: BlsStateData[] = [];
  const processedStates = new Set<string>();

  for (const record of records) {
    // Check if this is state-level data (area_fips ends with 000)
    if (!record.area_fips.endsWith('000')) {
      continue;
    }

    // Check if this is retail trade data
    if (!RETAIL_INDUSTRY_CODES.includes(record.industry_code)) {
      continue;
    }

    const stateAbbr = STATE_FIPS_CODES[record.area_fips];
    if (!stateAbbr) {
      logger.warn(`Unknown state FIPS code: ${record.area_fips}`);
      continue;
    }

    // Skip if we've already processed this state for this year
    if (processedStates.has(stateAbbr)) {
      continue;
    }

    const retailLq = parseFloat(record.lq_annual_avg_emplvl);
    if (isNaN(retailLq)) {
      logger.warn(
        `Invalid retail LQ value for ${stateAbbr}: ${record.lq_annual_avg_emplvl}`,
      );
      continue;
    }

    const stateDataRecord: BlsStateData = {
      state: stateAbbr,
      year,
      retailLq,
      timestamp: Math.floor(Date.now() / 1000),
    };

    stateData.push(stateDataRecord);
    processedStates.add(stateAbbr);
  }

  logger.info(
    `Extracted retail data for ${stateData.length} states for year ${year}`,
  );
  return stateData;
}

export function calculateTrendSlope(
  dataPoints: { year: number; retailLq: number }[],
): number {
  if (dataPoints.length < 2) {
    return 0;
  }

  // Sort by year to ensure chronological order
  const sortedData = [...dataPoints].sort((a, b) => a.year - b.year);

  // Calculate linear regression slope
  const n = sortedData.length;
  const sumX = sortedData.reduce((sum, point) => sum + point.year, 0);
  const sumY = sortedData.reduce((sum, point) => sum + point.retailLq, 0);
  const sumXY = sortedData.reduce(
    (sum, point) => sum + point.year * point.retailLq,
    0,
  );
  const sumXX = sortedData.reduce(
    (sum, point) => sum + point.year * point.year,
    0,
  );

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
}

export function determineTrendCategory(
  slope: number,
): 'declining' | 'stable' | 'growing' {
  const threshold = 0.001; // Small threshold to account for noise

  if (slope < -threshold) {
    return 'declining';
  } else if (slope > threshold) {
    return 'growing';
  } else {
    return 'stable';
  }
}

export function calculateBlockbusterScore(
  slope: number,
  trend: 'declining' | 'stable' | 'growing',
): number {
  // Base score calculation:
  // - Declining retail LQ = higher score (more disruption)
  // - Growing retail LQ = lower score (less disruption)
  // - Stable retail LQ = middle score

  let baseScore: number;

  switch (trend) {
    case 'declining':
      // Convert negative slope to positive score (0-100)
      // More negative slope = higher score
      baseScore = Math.min(100, Math.abs(slope) * 1000);
      break;
    case 'growing':
      // Convert positive slope to negative score (0-100)
      // More positive slope = lower score
      baseScore = Math.max(0, 100 - slope * 1000);
      break;
    case 'stable':
      // Middle score for stable trends
      baseScore = 50;
      break;
    default:
      baseScore = 50;
  }

  // Normalize to 0-100 range
  return Math.max(0, Math.min(100, baseScore));
}

export function validateStateData(data: BlsStateData): boolean {
  if (!data.state || typeof data.state !== 'string') {
    logger.warn('Invalid state in data', { data });
    return false;
  }

  if (
    !data.year ||
    typeof data.year !== 'number' ||
    data.year < 1990 ||
    data.year > 2030
  ) {
    logger.warn('Invalid year in data', { data });
    return false;
  }

  if (typeof data.retailLq !== 'number' || isNaN(data.retailLq)) {
    logger.warn('Invalid retailLq in data', { data });
    return false;
  }

  return true;
}

export function sortStateDataByYear(data: BlsStateData[]): BlsStateData[] {
  return [...data].sort((a, b) => a.year - b.year);
}

export function groupStateDataByState(
  data: BlsStateData[],
): Record<string, BlsStateData[]> {
  const grouped: Record<string, BlsStateData[]> = {};

  for (const record of data) {
    if (!grouped[record.state]) {
      grouped[record.state] = [];
    }
    grouped[record.state].push(record);
  }

  return grouped;
}
