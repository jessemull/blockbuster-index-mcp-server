import { TREND_THRESHOLDS } from '../../constants';

export function determineTrendCategory(
  slope: number,
): 'declining' | 'growing' | 'stable' {
  const threshold = TREND_THRESHOLDS.SLOPE_THRESHOLD;
  if (slope < -threshold) {
    return 'declining';
  } else if (slope > threshold) {
    return 'growing';
  } else {
    return 'stable';
  }
}
