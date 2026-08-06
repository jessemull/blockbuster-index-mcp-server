import { Signal } from '../../types';
import { calculateBlockbusterIndex } from './calculate-blockbuster-index';

describe('calculateBlockbusterIndex', () => {
  it('should return weighted state scores with metadata', () => {
    const signalResults = {
      [Signal.AMAZON]: { CA: 100, TX: 0 },
      [Signal.CENSUS]: { CA: 0, TX: 100 },
      [Signal.BROADBAND]: { CA: 50, TX: 50 },
      [Signal.WALMART]: { CA: 0, TX: 100 },
      [Signal.BLS_PHYSICAL]: { CA: 100, TX: 0 },
      [Signal.BLS_ECOMMERCE]: { CA: 100, TX: 0 },
    };

    const result = calculateBlockbusterIndex(signalResults, 'test');

    expect(result.metadata.version).toBe('test');
    expect(result.metadata.totalStates).toBeGreaterThan(0);
    expect(result.states.CA).toBeDefined();
    expect(result.states.TX).toBeDefined();
    expect(result.states.CA.score).toEqual(expect.any(Number));
    expect(result.states.CA.components[Signal.AMAZON]).toEqual(
      expect.any(Number),
    );
  });
});
