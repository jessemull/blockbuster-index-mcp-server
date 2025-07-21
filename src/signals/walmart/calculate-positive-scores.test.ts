import { calculatePositiveScores } from './calculate-positive-scores';

describe('calculatePositiveScores', () => {
  it('should calculate positive scores where higher job counts result in higher scores', () => {
    const jobCounts = {
      CA: 100,
      NY: 75,
      TX: 50,
      FL: 25,
    };

    const scores = calculatePositiveScores(jobCounts);

    expect(scores.CA).toBeGreaterThan(scores.NY);
    expect(scores.NY).toBeGreaterThan(scores.TX);
    expect(scores.TX).toBeGreaterThan(scores.FL);

    Object.values(scores).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0.05);
      expect(score).toBeLessThanOrEqual(0.2);
    });
  });

  it('should handle equal job counts', () => {
    const jobCounts = {
      CA: 50,
      TX: 50,
      NY: 50,
    };

    const scores = calculatePositiveScores(jobCounts);

    // When all job counts are equal, all scores should be 0.1
    Object.values(scores).forEach((score) => {
      expect(score).toBe(0.1);
    });
  });

  it('should handle single state', () => {
    const jobCounts = {
      CA: 100,
    };

    const scores = calculatePositiveScores(jobCounts);

    expect(scores.CA).toBe(0.1);
  });

  it('should handle zero job counts', () => {
    const jobCounts = {
      CA: 0,
      TX: 50,
      NY: 100,
    };

    const scores = calculatePositiveScores(jobCounts);

    expect(scores.CA).toBe(0.05);
    expect(scores.NY).toBe(0.2);
    expect(scores.TX).toBeGreaterThan(scores.CA);
    expect(scores.TX).toBeLessThan(scores.NY);
  });

  it('should return scores with 10 decimal places precision', () => {
    const jobCounts = {
      CA: 100,
      TX: 50,
    };

    const scores = calculatePositiveScores(jobCounts);

    Object.values(scores).forEach((score) => {
      const decimalPlaces = score.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(10);
    });
  });
});
