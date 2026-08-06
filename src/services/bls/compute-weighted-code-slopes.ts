import type { BlsStateData } from '../../types/bls';
import { calculateTrendSlope } from './calculate-trend-slope';
import { determineTrendCategory } from './determine-trend-category';

type CodeMapKey = 'brickAndMortarCodes' | 'ecommerceCodes';

/**
 * Computes a data-point-weighted average slope across NAICS codes for one retail channel.
 */
export function computeWeightedCodeSlopes(
  sortedData: BlsStateData[],
  codeMapKey: CodeMapKey,
): {
  dataPoints: number;
  slope: number;
  trend: 'declining' | 'growing' | 'stable';
} {
  const codeSlopes: Array<{
    dataPoints: number;
    slope: number;
  }> = [];
  let totalDataPoints = 0;

  // Get all unique codes for this state with positive LQ values...

  const allCodes = new Set<string>();
  for (const data of sortedData) {
    Object.keys(data[codeMapKey]).forEach((code) => {
      if (data[codeMapKey][code] > 0) {
        allCodes.add(code);
      }
    });
  }

  // Calculate individual slopes for each code...

  for (const code of allCodes) {
    const codeDataPoints: { retailLq: number; year: number }[] = [];

    for (const data of sortedData) {
      if (data[codeMapKey][code] && data[codeMapKey][code] > 0) {
        codeDataPoints.push({
          retailLq: data[codeMapKey][code],
          year: data.year,
        });
      }
    }

    if (codeDataPoints.length >= 2) {
      const codeSlope = calculateTrendSlope(codeDataPoints);
      codeSlopes.push({
        dataPoints: codeDataPoints.length,
        slope: codeSlope,
      });
      totalDataPoints += codeDataPoints.length;
    }
  }

  let slope = 0;
  let trend: 'declining' | 'growing' | 'stable' = 'stable';

  if (codeSlopes.length > 0) {
    // Calculate weighted average slope...

    const weightedSum = codeSlopes.reduce(
      (sum, codeData) => sum + codeData.slope * codeData.dataPoints,
      0,
    );
    slope = weightedSum / totalDataPoints;
    trend = determineTrendCategory(slope);
  }

  return {
    dataPoints: totalDataPoints,
    slope,
    trend,
  };
}
