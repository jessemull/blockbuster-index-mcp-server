import { normalizeScores } from './normalize-signal-scores';

describe('normalizeScores', () => {
  it('should min-max normalize scores to a 0-100 scale', () => {
    const result = normalizeScores({ CA: 10, TX: 20, NY: 30 });

    expect(result).toEqual({ CA: 0, TX: 50, NY: 100 });
  });

  it('should return 100 for all states when all values are equal', () => {
    const result = normalizeScores({ CA: 5, TX: 5 });

    expect(result).toEqual({ CA: 100, TX: 100 });
  });

  it('should respect min and max overrides', () => {
    const result = normalizeScores({ CA: 25, TX: 75 }, 0, 100);

    expect(result).toEqual({ CA: 25, TX: 75 });
  });
});
