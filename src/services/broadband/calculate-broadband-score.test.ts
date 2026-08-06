import { calculateBroadbandScore } from './calculate-broadband-score';

describe('calculateBroadbandScore', () => {
  it('should return a score between 0 and 1 for typical metrics', () => {
    const score = calculateBroadbandScore({
      broadbandAvailabilityPercent: 80,
      highSpeedAvailabilityPercent: 60,
      gigabitAvailabilityPercent: 20,
      technologyCounts: {
        fiber: 10,
        cable: 5,
        dsl: 2,
        wireless: 1,
        other: 0,
      },
    });

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should clamp perfect metrics to at most 1', () => {
    const score = calculateBroadbandScore({
      broadbandAvailabilityPercent: 100,
      highSpeedAvailabilityPercent: 100,
      gigabitAvailabilityPercent: 100,
      technologyCounts: {
        fiber: 1,
        cable: 1,
        dsl: 1,
        wireless: 1,
        other: 1,
      },
    });

    expect(score).toBeCloseTo(1, 10);
  });

  it('should return 0 when all metrics are zero', () => {
    const score = calculateBroadbandScore({
      broadbandAvailabilityPercent: 0,
      highSpeedAvailabilityPercent: 0,
      gigabitAvailabilityPercent: 0,
      technologyCounts: {
        fiber: 0,
        cable: 0,
        dsl: 0,
        wireless: 0,
        other: 0,
      },
    });

    expect(score).toBe(0);
  });
});
