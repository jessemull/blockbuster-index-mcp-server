import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';

describe('calculateWorkforceNormalizedScores', () => {
  it('calculates percentage of workforce scaled by 1,000,000 correctly', () => {
    const jobCounts = {
      CA: 1000,
      NY: 500,
      TX: 750,
    };

    const workforceData = {
      CA: 2000000,
      NY: 1000000,
      TX: 1500000,
    };

    const result = calculateWorkforceNormalizedScores(jobCounts, workforceData);

    // CA: (1000 / 2000000) * 100 * 1000000 = 0.05 * 1000000 = 50000
    // NY: (500 / 1000000) * 100 * 1000000 = 0.05 * 1000000 = 50000
    // TX: (750 / 1500000) * 100 * 1000000 = 0.05 * 1000000 = 50000
    expect(result).toEqual({
      CA: 50000,
      NY: 50000,
      TX: 50000,
    });
  });

  it('handles zero workforce size', () => {
    const jobCounts = {
      CA: 1000,
      NY: 500,
    };

    const workforceData = {
      CA: 2000000,
      NY: 0,
    };

    const result = calculateWorkforceNormalizedScores(jobCounts, workforceData);

    expect(result).toEqual({
      CA: 50000,
      NY: 0,
    });
  });

  it('handles missing workforce data', () => {
    const jobCounts = {
      CA: 1000,
      NY: 500,
    };

    const workforceData = {
      CA: 2000000,
    };

    const result = calculateWorkforceNormalizedScores(jobCounts, workforceData);

    expect(result).toEqual({
      CA: 50000,
      NY: 0,
    });
  });

  it('rounds to nearest integer', () => {
    const jobCounts = {
      CA: 1500,
    };

    const workforceData = {
      CA: 2000000,
    };

    const result = calculateWorkforceNormalizedScores(jobCounts, workforceData);

    // (1500 / 2000000) * 100 * 1000000 = 0.075 * 1000000 = 75000
    expect(result).toEqual({
      CA: 75000,
    });
  });
});
