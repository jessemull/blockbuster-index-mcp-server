import { calculateInvertedScores } from './calculate-inverted-scores';

describe('calculateInvertedScores', () => {
  it('should calculate inverted scores correctly', () => {
    const jobCounts = {
      CA: 100,
      TX: 200,
      NY: 50,
      FL: 150,
    };

    const result = calculateInvertedScores(jobCounts);

    // Higher job count should result in lower score (inverted)
    expect(result.CA).toBeGreaterThan(result.TX);
    expect(result.NY).toBeGreaterThan(result.FL);
    expect(result.NY).toBeGreaterThan(result.CA);
    expect(result.TX).toBeLessThan(result.CA);
  });

  it('should handle equal job counts', () => {
    const jobCounts = {
      CA: 100,
      TX: 100,
      NY: 100,
    };

    const result = calculateInvertedScores(jobCounts);

    expect(result.CA).toBe(0.1);
    expect(result.TX).toBe(0.1);
    expect(result.NY).toBe(0.1);
  });

  it('should handle single state', () => {
    const jobCounts = {
      CA: 100,
    };

    const result = calculateInvertedScores(jobCounts);

    expect(result.CA).toBe(0.1);
  });

  it('should ensure scores are within expected range', () => {
    const jobCounts = {
      CA: 50,
      TX: 200,
      NY: 100,
    };

    const result = calculateInvertedScores(jobCounts);

    // All scores should be between 0.05 and 0.2
    Object.values(result).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0.05);
      expect(score).toBeLessThanOrEqual(0.2);
    });
  });

  it('should handle zero job counts', () => {
    const jobCounts = {
      CA: 0,
      TX: 100,
      NY: 50,
    };

    const result = calculateInvertedScores(jobCounts);

    // State with 0 jobs should get the highest score
    expect(result.CA).toBeGreaterThan(result.TX);
    expect(result.CA).toBeGreaterThan(result.NY);
  });

  it('should return scores with 10 decimal places', () => {
    const jobCounts = {
      CA: 100,
      TX: 200,
    };

    const result = calculateInvertedScores(jobCounts);

    // Check that scores are properly formatted with 10 decimal places
    Object.values(result).forEach((score) => {
      const decimalPlaces = score.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(10);
    });
  });
});
