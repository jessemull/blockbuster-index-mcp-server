import { determineTrendCategory } from './determine-trend-category';
import { TREND_THRESHOLDS } from '../../constants';

describe('determineTrendCategory', () => {
  const threshold = TREND_THRESHOLDS.SLOPE_THRESHOLD;

  describe('Declining trends', () => {
    it('should classify negative slopes below threshold as declining', () => {
      const decliningSlopes = [-0.002, -0.01, -0.1, -1.0, -10.0, -100.0];

      decliningSlopes.forEach((slope) => {
        const result = determineTrendCategory(slope);
        expect(result).toBe('declining');
      });
    });

    it('should classify slope exactly at negative threshold as stable', () => {
      const result = determineTrendCategory(-threshold);
      expect(result).toBe('stable');
    });

    it('should classify slope just below negative threshold as declining', () => {
      const result = determineTrendCategory(-threshold - 0.0001);
      expect(result).toBe('declining');
    });
  });

  describe('Growing trends', () => {
    it('should classify positive slopes above threshold as growing', () => {
      const growingSlopes = [0.002, 0.01, 0.1, 1.0, 10.0, 100.0];

      growingSlopes.forEach((slope) => {
        const result = determineTrendCategory(slope);
        expect(result).toBe('growing');
      });
    });

    it('should classify slope exactly at positive threshold as stable', () => {
      const result = determineTrendCategory(threshold);
      expect(result).toBe('stable');
    });

    it('should classify slope just above positive threshold as growing', () => {
      const result = determineTrendCategory(threshold + 0.0001);
      expect(result).toBe('growing');
    });
  });

  describe('Stable trends', () => {
    it('should classify slopes within threshold range as stable', () => {
      const stableSlopes = [-0.0005, -0.0001, 0, 0.0001, 0.0005, 0.0009];

      stableSlopes.forEach((slope) => {
        const result = determineTrendCategory(slope);
        expect(result).toBe('stable');
      });
    });

    it('should classify zero slope as stable', () => {
      const result = determineTrendCategory(0);
      expect(result).toBe('stable');
    });

    it('should classify slope just below positive threshold as stable', () => {
      const result = determineTrendCategory(threshold - 0.0001);
      expect(result).toBe('stable');
    });

    it('should classify slope just above negative threshold as stable', () => {
      const result = determineTrendCategory(-threshold + 0.0001);
      expect(result).toBe('stable');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very small negative values', () => {
      const result = determineTrendCategory(-0.0000001);
      expect(result).toBe('stable');
    });

    it('should handle very small positive values', () => {
      const result = determineTrendCategory(0.0000001);
      expect(result).toBe('stable');
    });

    it('should handle very large negative values', () => {
      const result = determineTrendCategory(-999999.0);
      expect(result).toBe('declining');
    });

    it('should handle very large positive values', () => {
      const result = determineTrendCategory(999999.0);
      expect(result).toBe('growing');
    });

    it('should handle floating point precision issues', () => {
      const result1 = determineTrendCategory(0.0010000000000000001);
      const result2 = determineTrendCategory(-0.0010000000000000001);

      expect(result1).toBe('stable');
      expect(result2).toBe('stable');
    });
  });

  describe('Return value validation', () => {
    it('should return valid trend categories', () => {
      const validCategories = ['declining', 'stable', 'growing'];
      const testSlopes = [-1.0, 0, 1.0];

      testSlopes.forEach((slope) => {
        const result = determineTrendCategory(slope);
        expect(validCategories).toContain(result);
      });
    });

    it('should return string values', () => {
      const testSlopes = [-1.0, 0, 1.0];

      testSlopes.forEach((slope) => {
        const result = determineTrendCategory(slope);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Threshold boundary testing', () => {
    it('should correctly classify values at the exact threshold boundaries', () => {
      const result1 = determineTrendCategory(-threshold);
      const result2 = determineTrendCategory(threshold);

      expect(result1).toBe('stable');
      expect(result2).toBe('stable');
    });

    it('should correctly classify values just inside the threshold boundaries', () => {
      const result1 = determineTrendCategory(-threshold + 0.0000001);
      const result2 = determineTrendCategory(threshold - 0.0000001);

      expect(result1).toBe('stable');
      expect(result2).toBe('stable');
    });

    it('should correctly classify values just outside the threshold boundaries', () => {
      const result1 = determineTrendCategory(-threshold - 0.0000001);
      const result2 = determineTrendCategory(threshold + 0.0000001);

      expect(result1).toBe('declining');
      expect(result2).toBe('growing');
    });
  });

  describe('Real-world slope scenarios', () => {
    it('should handle typical BLS slope values', () => {
      const testCases = [
        { slope: -0.05, expected: 'declining' },
        { slope: -0.01, expected: 'declining' },
        { slope: -0.001, expected: 'stable' },
        { slope: -0.0005, expected: 'stable' },
        { slope: 0, expected: 'stable' },
        { slope: 0.0005, expected: 'stable' },
        { slope: 0.001, expected: 'stable' },
        { slope: 0.01, expected: 'growing' },
        { slope: 0.05, expected: 'growing' },
      ];

      testCases.forEach(({ slope, expected }) => {
        const result = determineTrendCategory(slope);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept number parameter and return trend category', () => {
      const result = determineTrendCategory(0.5);
      expect(typeof result).toBe('string');
      expect(['declining', 'stable', 'growing']).toContain(result);
    });

    it('should handle all numeric input types', () => {
      const testValues = [
        Number.MIN_SAFE_INTEGER,
        -1,
        -0.5,
        0,
        0.5,
        1,
        Number.MAX_SAFE_INTEGER,
      ];

      testValues.forEach((value) => {
        const result = determineTrendCategory(value);
        expect(['declining', 'stable', 'growing']).toContain(result);
      });
    });
  });
});
