import type { TechnologyCounts } from '../../types/broadband';

/**
 * Weighted broadband score from availability + technology diversity metrics.
 * Returns a value clamped to [0, 1].
 */
export function calculateBroadbandScore(metrics: {
  broadbandAvailabilityPercent: number;
  gigabitAvailabilityPercent: number;
  highSpeedAvailabilityPercent: number;
  technologyCounts: TechnologyCounts;
}): number {
  const totalTech = Object.values(metrics.technologyCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const diversityScore =
    totalTech > 0
      ? Object.values(metrics.technologyCounts).filter((count) => count > 0)
          .length / 5
      : 0;

  const score =
    (metrics.broadbandAvailabilityPercent / 100) * 0.3 +
    (metrics.highSpeedAvailabilityPercent / 100) * 0.4 +
    (metrics.gigabitAvailabilityPercent / 100) * 0.2 +
    diversityScore * 0.1;

  return Math.min(1, Math.max(0, score));
}
