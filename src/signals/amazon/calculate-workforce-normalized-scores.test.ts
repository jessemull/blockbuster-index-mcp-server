import { calculateWorkforceNormalizedScores } from './calculate-workforce-normalized-scores';

describe('calculateWorkforceNormalizedScores', () => {
  it('calculates jobs per 1000 workers correctly', () => {
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

    expect(result).toEqual({
      CA: 1,
      NY: 1,
      TX: 1,
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
      CA: 1,
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
      CA: 1,
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

    expect(result).toEqual({
      CA: 1,
    });
  });
});
