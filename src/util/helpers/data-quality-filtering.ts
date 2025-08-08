/**
 * Data quality filtering utilities for BLS scores.
 * Focuses on detecting actual data quality issues without making assumptions about trends.
 */

export interface DataQualityMetrics {
  totalDataPoints: number;
  validDataPoints: number;
  zeroValueCount: number;
  negativeValueCount: number;
  largeGaps: Array<{ fromYear: number; toYear: number; gapSize: number }>;
  outliers: Array<{ year: number; value: number; reason: string }>;
  dataQualityScore: number; // 0-100, higher is better
}

export interface FilteredDataPoint {
  year: number;
  retailLq: number;
  wasFiltered: boolean;
  filterReason?: string;
}

/**
 * Detects actual data quality issues without making assumptions about trends.
 * Focuses on technical data problems, not business logic.
 */
export function analyzeDataQuality(
  dataPoints: Array<{ year: number; retailLq: number }>,
  options: {
    maxGapYears?: number;
    outlierThreshold?: number;
    minValidPoints?: number;
  } = {},
): DataQualityMetrics {
  const {
    maxGapYears = 3,
    outlierThreshold = 2.5,
    minValidPoints = 5,
  } = options;

  const sortedData = [...dataPoints].sort((a, b) => a.year - b.year);
  const totalDataPoints = sortedData.length;

  let validDataPoints = 0;
  let zeroValueCount = 0;
  let negativeValueCount = 0;
  const largeGaps: Array<{
    fromYear: number;
    toYear: number;
    gapSize: number;
  }> = [];
  const outliers: Array<{ year: number; value: number; reason: string }> = [];

  // Check for data quality issues...

  for (let i = 0; i < sortedData.length; i++) {
    const point = sortedData[i];

    // Count zero and negative values (actual data quality issues)...

    if (point.retailLq === 0) {
      zeroValueCount++;
      outliers.push({
        year: point.year,
        value: point.retailLq,
        reason: 'zero_value',
      });
    } else if (point.retailLq < 0) {
      negativeValueCount++;
      outliers.push({
        year: point.year,
        value: point.retailLq,
        reason: 'negative_value',
      });
    } else {
      validDataPoints++;
    }

    // Check for large gaps (missing data)...

    if (i > 0) {
      const prev = sortedData[i - 1];
      const gap = point.year - prev.year;
      if (gap > maxGapYears) {
        largeGaps.push({
          fromYear: prev.year,
          toYear: point.year,
          gapSize: gap,
        });
      }
    }
  }

  // Calculate statistical outliers (not business logic outliers)...

  if (validDataPoints >= minValidPoints) {
    const validValues = sortedData
      .filter((point) => point.retailLq > 0)
      .map((point) => point.retailLq);

    const mean =
      validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const variance =
      validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      validValues.length;
    const stdDev = Math.sqrt(variance);

    // Find statistical outliers...

    for (const point of sortedData) {
      if (point.retailLq > 0) {
        const zScore = Math.abs((point.retailLq - mean) / stdDev);
        if (zScore > outlierThreshold) {
          outliers.push({
            year: point.year,
            value: point.retailLq,
            reason: `statistical_outlier_z${zScore.toFixed(1)}`,
          });
        }
      }
    }
  }

  // Calculate overall data quality score...

  const qualityFactors = [
    validDataPoints / totalDataPoints, // Valid data ratio
    1 - largeGaps.length / Math.max(1, totalDataPoints - 1), // Gap ratio
    1 - outliers.length / totalDataPoints, // Outlier ratio
  ];

  const dataQualityScore = Math.round(
    (qualityFactors.reduce((sum, factor) => sum + factor, 0) /
      qualityFactors.length) *
      100,
  );

  return {
    totalDataPoints,
    validDataPoints,
    zeroValueCount,
    negativeValueCount,
    largeGaps,
    outliers,
    dataQualityScore,
  };
}

/**
 * Filters data based on actual quality issues, not business assumptions
 * Returns both filtered data and quality metrics.
 */
export function filterDataQualityIssues(
  dataPoints: Array<{ year: number; retailLq: number }>,
  options: {
    filterZeros?: boolean;
    filterNegatives?: boolean;
    filterLargeGaps?: boolean;
    filterStatisticalOutliers?: boolean;
    maxGapYears?: number;
    outlierThreshold?: number;
  } = {},
): {
  filteredData: FilteredDataPoint[];
  qualityMetrics: DataQualityMetrics;
} {
  const {
    filterZeros = true,
    filterNegatives = true,
    filterStatisticalOutliers = false, // Don't filter outliers by default
    maxGapYears = 3,
    outlierThreshold = 2.5,
  } = options;

  const qualityMetrics = analyzeDataQuality(dataPoints, {
    maxGapYears,
    outlierThreshold,
  });

  const sortedData = [...dataPoints].sort((a, b) => a.year - b.year);
  const filteredData: FilteredDataPoint[] = [];

  for (const point of sortedData) {
    let wasFiltered = false;
    let filterReason: string | undefined;

    // Apply filters based on actual data quality issues...

    if (filterZeros && point.retailLq === 0) {
      wasFiltered = true;
      filterReason = 'zero_value';
    } else if (filterNegatives && point.retailLq < 0) {
      wasFiltered = true;
      filterReason = 'negative_value';
    } else if (filterStatisticalOutliers) {
      const outlier = qualityMetrics.outliers.find(
        (o) => o.year === point.year && o.reason.startsWith('statistical'),
      );
      if (outlier) {
        wasFiltered = true;
        filterReason = outlier.reason;
      }
    }

    filteredData.push({
      year: point.year,
      retailLq: point.retailLq,
      wasFiltered,
      filterReason,
    });
  }

  return { filteredData, qualityMetrics };
}

/**
 * Logs data quality analysis for debugging.
 */
export function logDataQualityAnalysis(
  metrics: DataQualityMetrics,
  state: string,
  signalType: 'physical' | 'ecommerce',
): void {
  console.log(
    `=== ${state.toUpperCase()} ${signalType.toUpperCase()} DATA QUALITY ===`,
  );
  console.log(`Total data points: ${metrics.totalDataPoints}`);
  console.log(`Valid data points: ${metrics.validDataPoints}`);
  console.log(`Data quality score: ${metrics.dataQualityScore}/100`);

  if (metrics.zeroValueCount > 0) {
    console.log(`Zero values: ${metrics.zeroValueCount}`);
  }

  if (metrics.negativeValueCount > 0) {
    console.log(`Negative values: ${metrics.negativeValueCount}`);
  }

  if (metrics.largeGaps.length > 0) {
    console.log(`Large gaps: ${metrics.largeGaps.length}`);
    metrics.largeGaps.forEach((gap) => {
      console.log(`  ${gap.fromYear} -> ${gap.toYear} (${gap.gapSize} years)`);
    });
  }

  if (metrics.outliers.length > 0) {
    console.log(`Outliers: ${metrics.outliers.length}`);
    metrics.outliers.forEach((outlier) => {
      console.log(`  ${outlier.year}: ${outlier.value} (${outlier.reason})`);
    });
  }

  console.log('');
}
