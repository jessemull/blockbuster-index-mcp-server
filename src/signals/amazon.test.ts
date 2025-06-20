import { States } from '../types';
import { getAmazonScores } from '../signals';

describe('getAmazonScores', () => {
  it('should return a score for every state', async () => {
    const result = await getAmazonScores();

    expect(typeof result).toBe('object');

    Object.entries(result).forEach(([key, value]) => {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('number');
    });

    const states = Object.values(States);

    expect(Object.keys(result).sort()).toEqual(states.sort());
  });
});
