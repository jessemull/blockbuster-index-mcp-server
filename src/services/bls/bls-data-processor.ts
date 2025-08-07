import { logger } from '../../util';
import {
  BLS_INDUSTRY_CODES,
  STATE_FIPS_CODES,
  TREND_THRESHOLDS,
} from '../../constants';
import type { BlsCsvRecord, BlsStateData } from '../../types/bls';

export function extractBrickAndMortarRetailDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  const stateAggregatedData: Record<string, Record<string, number>> = {};

  for (const record of records) {
    // Check if this is state-level data (area_fips ends with 000)
    if (!record.area_fips.endsWith('000')) {
      continue;
    }

    // Check if this is brick and mortar retail data (using NAICS codes in industry_code column)
    const isBrickAndMortarRetail =
      BLS_INDUSTRY_CODES.BRICK_AND_MORTAR_RETAIL_NAICS.some((code) =>
        record.industry_code.startsWith(code),
      );

    if (!isBrickAndMortarRetail) {
      continue;
    }

    const stateAbbr = STATE_FIPS_CODES[record.area_fips];
    if (!stateAbbr) {
      continue;
    }

    const retailLq = parseFloat(record.lq_annual_avg_emplvl);
    if (isNaN(retailLq)) {
      continue;
    }

    // Aggregate by state and industry code
    if (!stateAggregatedData[stateAbbr]) {
      stateAggregatedData[stateAbbr] = {};
    }

    // Sum the retailLq for this industry code in this state
    if (!stateAggregatedData[stateAbbr][record.industry_code]) {
      stateAggregatedData[stateAbbr][record.industry_code] = 0;
    }
    stateAggregatedData[stateAbbr][record.industry_code] += retailLq;
  }

  // Convert aggregated data to BlsStateData format
  const stateData: BlsStateData[] = [];
  for (const [state, industryCodes] of Object.entries(stateAggregatedData)) {
    const stateDataRecord: BlsStateData = {
      state,
      year,
      timestamp: Math.floor(Date.now() / 1000),
      brickAndMortarCodes: industryCodes,
      ecommerceCodes: {},
    };

    stateData.push(stateDataRecord);
  }

  if (stateData.length > 0) {
    logger.info(
      `Extracted ${stateData.length} brick and mortar retail records for year ${year}`,
    );
  }
  return stateData;
}

export function extractEcommerceDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  const stateAggregatedData: Record<string, Record<string, number>> = {};

  for (const record of records) {
    // Check if this is state-level data (area_fips ends with 000)
    if (!record.area_fips.endsWith('000')) {
      continue;
    }

    // Check if this is e-commerce data (using NAICS codes in industry_code column)
    const isECommerce = BLS_INDUSTRY_CODES.E_COMMERCE_NAICS.some((code) =>
      record.industry_code.startsWith(code),
    );

    if (!isECommerce) {
      continue;
    }

    const stateAbbr = STATE_FIPS_CODES[record.area_fips];
    if (!stateAbbr) {
      continue;
    }

    const retailLq = parseFloat(record.lq_annual_avg_emplvl);
    if (isNaN(retailLq)) {
      continue;
    }

    // Aggregate by state and industry code
    if (!stateAggregatedData[stateAbbr]) {
      stateAggregatedData[stateAbbr] = {};
    }

    // Sum the retailLq for this industry code in this state
    if (!stateAggregatedData[stateAbbr][record.industry_code]) {
      stateAggregatedData[stateAbbr][record.industry_code] = 0;
    }
    stateAggregatedData[stateAbbr][record.industry_code] += retailLq;
  }

  // Convert aggregated data to BlsStateData format
  const stateData: BlsStateData[] = [];
  for (const [state, industryCodes] of Object.entries(stateAggregatedData)) {
    const stateDataRecord: BlsStateData = {
      state,
      year,
      timestamp: Math.floor(Date.now() / 1000),
      brickAndMortarCodes: {},
      ecommerceCodes: industryCodes,
    };

    stateData.push(stateDataRecord);
  }

  if (stateData.length > 0) {
    logger.info(
      `Extracted ${stateData.length} e-commerce records for year ${year}`,
    );
  }
  return stateData;
}

export function extractCombinedRetailDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  const stateAggregatedData: Record<
    string,
    {
      brickAndMortarCodes: Record<string, number>;
      ecommerceCodes: Record<string, number>;
    }
  > = {};

  let processedRecords = 0;
  let validRecords = 0;

  for (const record of records) {
    processedRecords++;

    // Check if this is state-level data (area_fips ends with 000)
    if (!record.area_fips.endsWith('000')) {
      continue;
    }

    const stateAbbr = STATE_FIPS_CODES[record.area_fips];
    if (!stateAbbr) {
      continue;
    }

    const retailLq = parseFloat(record.lq_annual_avg_emplvl);
    if (isNaN(retailLq) || retailLq < 0) {
      continue;
    }

    // Check if this is e-commerce data first (for zero value filtering)
    const isECommerce = BLS_INDUSTRY_CODES.E_COMMERCE_NAICS.some((code) =>
      record.industry_code.startsWith(code),
    );

    // For e-commerce, skip zero values as they don't represent actual activity
    if (isECommerce && retailLq === 0) {
      continue;
    }

    // Initialize state data if not exists
    if (!stateAggregatedData[stateAbbr]) {
      stateAggregatedData[stateAbbr] = {
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      };
    }

    // Check if this is brick and mortar retail data
    const isBrickAndMortarRetail =
      BLS_INDUSTRY_CODES.BRICK_AND_MORTAR_RETAIL_NAICS.some((code) =>
        record.industry_code.startsWith(code),
      );

    // Add to appropriate category
    if (isBrickAndMortarRetail) {
      if (
        !stateAggregatedData[stateAbbr].brickAndMortarCodes[
          record.industry_code
        ]
      ) {
        stateAggregatedData[stateAbbr].brickAndMortarCodes[
          record.industry_code
        ] = 0;
      }
      stateAggregatedData[stateAbbr].brickAndMortarCodes[
        record.industry_code
      ] += retailLq;
      validRecords++;
    }

    if (isECommerce) {
      if (
        !stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code]
      ) {
        stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code] = 0;
      }
      stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code] +=
        retailLq;
      validRecords++;
    }
  }

  // Convert aggregated data to BlsStateData format
  const stateData: BlsStateData[] = [];
  for (const [state, aggregatedData] of Object.entries(stateAggregatedData)) {
    const stateDataRecord: BlsStateData = {
      state,
      year,
      timestamp: Math.floor(Date.now() / 1000),
      brickAndMortarCodes: aggregatedData.brickAndMortarCodes,
      ecommerceCodes: aggregatedData.ecommerceCodes,
    };

    stateData.push(stateDataRecord);
  }

  if (stateData.length > 0) {
    logger.info(
      `Extracted ${stateData.length} combined retail records for year ${year} (${validRecords} valid records from ${processedRecords} total)`,
    );
  }
  return stateData;
}

// Keep the original function for backward compatibility
export function extractRetailDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  return extractBrickAndMortarRetailDataFromCsv(records, year);
}

export function calculateTrendSlope(
  dataPoints: { year: number; retailLq: number }[],
): number {
  if (dataPoints.length < 2) {
    return 0;
  }

  // Sort by year to ensure chronological order...
  const sortedData = [...dataPoints].sort((a, b) => a.year - b.year);

  // Filter out zero and negative values (data quality issues)
  const validData = sortedData.filter((point) => point.retailLq > 0);

  if (validData.length < 2) {
    logger.warn('Insufficient valid data points for slope calculation');
    return 0;
  }

  // Calculate linear regression slope...
  const n = validData.length;
  const sumX = validData.reduce((sum, point) => sum + point.year, 0);
  const sumY = validData.reduce((sum, point) => sum + point.retailLq, 0);
  const sumXY = validData.reduce(
    (sum, point) => sum + point.year * point.retailLq,
    0,
  );
  const sumXX = validData.reduce(
    (sum, point) => sum + point.year * point.year,
    0,
  );

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Log data quality info
  if (validData.length < sortedData.length) {
    logger.info(
      `Filtered ${sortedData.length - validData.length} invalid data points for slope calculation`,
    );
  }

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

      baseScore = Math.min(100, Math.max(0, Math.abs(slope) * 0.1));
      break;
    case 'growing':
      // Convert positive slope to lower score (0-100).
      // More positive slope = lower score.

      baseScore = Math.max(0, 100 - slope * 0.1);
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

  // Check that we have at least some data in one of the code mappings
  const hasBrickAndMortarData =
    Object.keys(data.brickAndMortarCodes).length > 0;
  const hasEcommerceData = Object.keys(data.ecommerceCodes).length > 0;

  if (!hasBrickAndMortarData && !hasEcommerceData) {
    logger.warn('No valid code data in state data', { data });
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
