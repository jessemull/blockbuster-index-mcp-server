/**
 * Outlier detection and handling utilities for BLS scores
 */

export interface OutlierAnalysis {
  outliers: string[];
  median: number;
  mean: number;
  standardDeviation: number;
  correctedScores: Record<string, number>;
}

/**
 * Detects outliers using z-score analysis (> 2 standard deviations from mean)
 * and replaces them with the national median
 */
export function detectAndCorrectOutliers(
  scores: Record<string, number>,
  threshold: number = 2.0,
): OutlierAnalysis {
  const values = Object.values(scores);
  const states = Object.keys(scores);

  // Calculate statistics
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const standardDeviation = Math.sqrt(variance);

  // Calculate median
  const sortedValues = [...values].sort((a, b) => a - b);
  const median =
    sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1] +
          sortedValues[sortedValues.length / 2]) /
        2
      : sortedValues[Math.floor(sortedValues.length / 2)];

  // Find outliers
  const outliers: string[] = [];
  const correctedScores: Record<string, number> = { ...scores };

  states.forEach((state) => {
    const score = scores[state];
    const zScore = Math.abs((score - mean) / standardDeviation);
    if (state === 'CA') console.log(score, zScore, threshold);
    if (zScore > threshold) {
      outliers.push(state);
      correctedScores[state] = median;
    }
  });

  return {
    outliers,
    median,
    mean,
    standardDeviation,
    correctedScores,
  };
}

/**
 * Logs outlier analysis results for debugging
 */
export function logOutlierAnalysis(
  analysis: OutlierAnalysis,
  scoreType: 'physical' | 'ecommerce',
): void {
  const { outliers, median, mean, standardDeviation } = analysis;

  console.log(`=== ${scoreType.toUpperCase()} SCORE OUTLIER ANALYSIS ===`);
  console.log(`Mean: ${mean.toFixed(2)}`);
  console.log(`Median: ${median.toFixed(2)}`);
  console.log(`Standard Deviation: ${standardDeviation.toFixed(2)}`);
  console.log(`Outliers (> 2 SD): ${outliers.length}`);

  if (outliers.length > 0) {
    console.log(`Outlier states: ${outliers.join(', ')}`);
    console.log(`Replaced with median: ${median.toFixed(2)}`);
  }
  console.log('');
}
