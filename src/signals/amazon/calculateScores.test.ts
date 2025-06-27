import { calculateScores } from './calculateScores';

describe('calculateScores', () => {
  it('returns equal scores if all job counts are the same', () => {
    expect(calculateScores({ CA: 5, TX: 5 })).toEqual({ CA: 0.1, TX: 0.1 });
  });

  it('normalizes scores if job counts differ', () => {
    const result = calculateScores({ CA: 0, TX: 100 });
    expect(result.CA).toBeCloseTo(0.05, 2);
    expect(result.TX).toBeCloseTo(0.2, 2);
  });

  it('handles negative job counts', () => {
    const result = calculateScores({ CA: -10, TX: 10 });
    expect(result.CA).toBeCloseTo(0.05, 2);
    expect(result.TX).toBeCloseTo(0.2, 2);
  });

  it('handles empty jobCounts', () => {
    expect(calculateScores({})).toEqual({});
  });

  it('handles single state', () => {
    const result = calculateScores({ CA: 50 });
    expect(result.CA).toBe(0.1);
  });

  it('handles zero job counts', () => {
    const result = calculateScores({ CA: 0, TX: 0 });
    expect(result.CA).toBe(0.1);
    expect(result.TX).toBe(0.1);
  });

  it('handles mixed job counts including zero', () => {
    const result = calculateScores({ CA: 0, TX: 100 });
    expect(result.CA).toBe(0.05);
    expect(result.TX).toBe(0.2);
  });
});
