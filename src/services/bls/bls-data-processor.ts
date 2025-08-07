import { logger } from '../../util';
import {
  BLS_INDUSTRY_CODES,
  STATE_FIPS_CODES,
  TREND_THRESHOLDS,
} from '../../constants';
import type { BlsCsvRecord, BlsStateData } from '../../types/bls';

function isValidStateRecord(record: BlsCsvRecord): {
  isValid: boolean;
  stateAbbr?: string;
  retailLq?: number;
} {
  // Check if this is state-level data (area_fips ends with 000)...
  if (!record.area_fips.endsWith('000')) {
    return { isValid: false };
  }

  const stateAbbr = STATE_FIPS_CODES[record.area_fips];
  if (!stateAbbr) {
    return { isValid: false };
  }

  const retailLq = parseFloat(record.lq_annual_avg_emplvl);
  if (isNaN(retailLq) || retailLq <= 0) {
    return { isValid: false };
  }

  return { isValid: true, stateAbbr, retailLq };
}

function classifyIndustry(record: BlsCsvRecord): {
  isECommerce: boolean;
  isBrickAndMortarRetail: boolean;
} {
  const isECommerce = BLS_INDUSTRY_CODES.E_COMMERCE_NAICS.some((code) =>
    record.industry_code.startsWith(code),
  );

  const isBrickAndMortarRetail =
    BLS_INDUSTRY_CODES.BRICK_AND_MORTAR_RETAIL_NAICS.some((code) =>
      record.industry_code.startsWith(code),
    );

  return { isECommerce, isBrickAndMortarRetail };
}

function aggregateRecordData(
  stateAggregatedData: Record<
    string,
    {
      brickAndMortarCodes: Record<string, number>;
      ecommerceCodes: Record<string, number>;
    }
  >,
  stateAbbr: string,
  record: BlsCsvRecord,
  retailLq: number,
  isBrickAndMortarRetail: boolean,
  isECommerce: boolean,
): number {
  // Initialize state data if not exists...
  if (!stateAggregatedData[stateAbbr]) {
    stateAggregatedData[stateAbbr] = {
      brickAndMortarCodes: {},
      ecommerceCodes: {},
    };
  }

  let validRecords = 0;

  // Add to appropriate category...
  if (isBrickAndMortarRetail) {
    if (
      !stateAggregatedData[stateAbbr].brickAndMortarCodes[record.industry_code]
    ) {
      stateAggregatedData[stateAbbr].brickAndMortarCodes[record.industry_code] =
        0;
    }
    stateAggregatedData[stateAbbr].brickAndMortarCodes[record.industry_code] +=
      retailLq;
    validRecords++;
  }

  if (isECommerce) {
    if (!stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code]) {
      stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code] = 0;
    }
    stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code] +=
      retailLq;
    validRecords++;
  }

  return validRecords;
}

function convertToStateData(
  stateAggregatedData: Record<
    string,
    {
      brickAndMortarCodes: Record<string, number>;
      ecommerceCodes: Record<string, number>;
    }
  >,
  year: number,
): BlsStateData[] {
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

    const validation = isValidStateRecord(record);
    if (!validation.isValid) {
      continue;
    }

    const { stateAbbr, retailLq } = validation;
    const { isECommerce, isBrickAndMortarRetail } = classifyIndustry(record);

    const newValidRecords = aggregateRecordData(
      stateAggregatedData,
      stateAbbr!,
      record,
      retailLq!,
      isBrickAndMortarRetail,
      isECommerce,
    );
    validRecords += newValidRecords;
  }

  const stateData = convertToStateData(stateAggregatedData, year);

  if (stateData.length > 0) {
    logger.info(
      `Extracted ${stateData.length} combined retail records for year ${year} (${validRecords} valid records from ${processedRecords} total)`,
    );
  }
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

  // Filter out zero and negative values (data quality issues)...

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

  // Log data quality info...

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

export function validateStateData(data: BlsStateData): boolean {
  if (!data.state || typeof data.state !== 'string') {
    logger.warn('Invalid state in data', { data });
    return false;
  }

  if (!data.year || typeof data.year !== 'number') {
    logger.warn('Invalid year in data', { data });
    return false;
  }

  const hasBrickAndMortarData =
    Object.keys(data.brickAndMortarCodes).length > 0;

  const hasEcommerceData = Object.keys(data.ecommerceCodes).length > 0;

  if (!hasBrickAndMortarData && !hasEcommerceData) {
    logger.warn('No valid code data in state data', { data });
    return false;
  }

  return true;
}
