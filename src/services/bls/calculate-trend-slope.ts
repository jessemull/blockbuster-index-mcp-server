import { logger } from '../../util';

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

  // Normalize years to start from 0 to prevent numerical instability...

  const minYear = Math.min(...validData.map((point) => point.year));

  const normalizedData = validData.map((point) => ({
    year: point.year - minYear,
    retailLq: point.retailLq,
  }));

  // Calculate linear regression slope using normalized years...

  const n = normalizedData.length;
  const sumX = normalizedData.reduce((sum, point) => sum + point.year, 0);
  const sumY = normalizedData.reduce((sum, point) => sum + point.retailLq, 0);
  const sumXY = normalizedData.reduce(
    (sum, point) => sum + point.year * point.retailLq,
    0,
  );
  const sumXX = normalizedData.reduce(
    (sum, point) => sum + point.year * point.year,
    0,
  );

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  if (validData.length < sortedData.length) {
    logger.info(
      `Filtered ${sortedData.length - validData.length} invalid data points for slope calculation`,
    );
  }

  return slope;
}
