import { logger } from '../../util';
import {
  BLS_INDUSTRY_CODES,
  STATE_FIPS_CODES,
  TREND_THRESHOLDS,
} from '../../constants';
import type { BlsCsvRecord, BlsStateData } from '../../types/bls';

export function extractRetailDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  logger.info(
    `Extracting retail data from ${records.length} records for year ${year}`,
  );

  const stateData: BlsStateData[] = [];
  const processedStates = new Set<string>();
  let stateLevelRecords = 0;
  let retailRecords = 0;
  let unknownFips = 0;
  let invalidLq = 0;
  const industryCodes = new Set<string>();

  for (const record of records) {
    // Check if this is state-level data (area_fips ends with 000)...

    if (!record.area_fips.endsWith('000')) {
      continue;
    }
    stateLevelRecords++;
    industryCodes.add(record.industry_code);

    // Check if this is retail trade data (using SIC codes for all years)...
    // Match by prefix to handle codes like 5213, 5311, etc.

    const isRetailTrade = BLS_INDUSTRY_CODES.RETAIL_TRADE_SIC.some((prefix) =>
      record.industry_code.startsWith(prefix),
    );

    if (!isRetailTrade) {
      continue;
    }
    retailRecords++;

    const stateAbbr = STATE_FIPS_CODES[record.area_fips];
    if (!stateAbbr) {
      logger.warn(`Unknown state FIPS code: ${record.area_fips}`);
      unknownFips++;
      continue;
    }

    // Skip if we've already processed this state for this year...

    if (processedStates.has(stateAbbr)) {
      continue;
    }

    const retailLq = parseFloat(record.lq_annual_avg_emplvl);
    if (isNaN(retailLq)) {
      logger.warn(
        `Invalid retail LQ value for ${stateAbbr}: ${record.lq_annual_avg_emplvl}`,
      );
      invalidLq++;
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
    {
      totalRecords: records.length,
      stateLevelRecords,
      retailRecords,
      unknownFips,
      invalidLq,
      validStates: stateData.length,
      industryCodes: Array.from(industryCodes).slice(0, 10), // Show first 10 codes
    },
  );
  return stateData;
}

export function calculateTrendSlope(
  dataPoints: { year: number; retailLq: number }[],
): number {
  if (dataPoints.length < 2) {
    return 0;
  }

  // Sort by year to ensure chronological order...

  const sortedData = [...dataPoints].sort((a, b) => a.year - b.year);

  // Calculate linear regression slope...

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
  const threshold = TREND_THRESHOLDS.SLOPE_THRESHOLD;

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
  // - Declining retail LQ = higher score (more disruption).
  // - Growing retail LQ = lower score (less disruption).
  // - Stable retail LQ = middle score.

  let baseScore: number;

  switch (trend) {
    case 'declining':
      // Convert negative slope to positive score (0-100).
      // More negative slope = higher score.

      baseScore = Math.min(100, Math.abs(slope) * 1000);
      break;
    case 'growing':
      // Convert positive slope to negative score (0-100).
      // More positive slope = lower score.

      baseScore = Math.max(0, 100 - slope * 1000);
      break;
    case 'stable':
      // Middle score for stable trends...

      baseScore = 50;
      break;
    default:
      baseScore = 50;
  }

  // Normalize to 0-100 range...

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
