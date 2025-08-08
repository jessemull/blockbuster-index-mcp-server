import {
  detectAndCorrectOutliers,
  logOutlierAnalysis,
  OutlierAnalysis,
} from './outlier-detection';

describe('outlier-detection', () => {
  describe('detectAndCorrectOutliers', () => {
    it('should use custom threshold', () => {
      const scores = {
        CA: 100,
        TX: 50,
        NY: 55,
        FL: 45,
        IL: 52,
      };

      const result = detectAndCorrectOutliers(scores, 1.5);

      expect(result.outliers).toContain('CA');
      expect(result.outliers.length).toBe(1);
    });

    it('should handle no outliers', () => {
      const scores = {
        TX: 50,
        NY: 55,
        FL: 45,
        IL: 52,
      };

      const result = detectAndCorrectOutliers(scores);

      expect(result.outliers).toEqual([]);
      expect(result.correctedScores).toEqual(scores);
    });

    it('should handle single data point', () => {
      const scores = {
        CA: 100,
      };

      const result = detectAndCorrectOutliers(scores);

      expect(result.outliers).toEqual([]);
      expect(result.correctedScores).toEqual(scores);
      expect(result.median).toBe(100);
      expect(result.mean).toBe(100);
      expect(result.standardDeviation).toBe(0);
    });

    it('should handle even number of data points for median calculation', () => {
      const scores = {
        TX: 50,
        NY: 55,
        FL: 45,
        IL: 52,
      };

      const result = detectAndCorrectOutliers(scores);

      expect(result.median).toBe(51);
    });

    it('should handle odd number of data points for median calculation', () => {
      const scores = {
        TX: 50,
        NY: 55,
        FL: 45,
        IL: 52,
        CA: 48,
      };

      const result = detectAndCorrectOutliers(scores);

      expect(result.median).toBe(50);
    });

    it('should handle all identical values', () => {
      const scores = {
        CA: 50,
        TX: 50,
        NY: 50,
        FL: 50,
        IL: 50,
      };

      const result = detectAndCorrectOutliers(scores);

      expect(result.outliers).toEqual([]);
      expect(result.correctedScores).toEqual(scores);
      expect(result.standardDeviation).toBe(0);
    });

    it('should preserve original scores for non-outliers', () => {
      const scores = {
        CA: 200,
        TX: 50,
        NY: 55,
        FL: 45,
        IL: 52,
      };

      const result = detectAndCorrectOutliers(scores);

      expect(result.correctedScores.TX).toBe(50);
      expect(result.correctedScores.NY).toBe(55);
      expect(result.correctedScores.FL).toBe(45);
      expect(result.correctedScores.IL).toBe(52);
    });
  });

  describe('logOutlierAnalysis', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log physical score analysis', () => {
      const analysis: OutlierAnalysis = {
        outliers: ['CA', 'NY'],
        median: 50,
        mean: 55.5,
        standardDeviation: 15.2,
        correctedScores: { CA: 50, NY: 50, TX: 45 },
      };

      logOutlierAnalysis(analysis, 'physical');

      expect(consoleSpy).toHaveBeenCalledWith(
        '=== PHYSICAL SCORE OUTLIER ANALYSIS ===',
      );
      expect(consoleSpy).toHaveBeenCalledWith('Mean: 55.50');
      expect(consoleSpy).toHaveBeenCalledWith('Median: 50.00');
      expect(consoleSpy).toHaveBeenCalledWith('Standard Deviation: 15.20');
      expect(consoleSpy).toHaveBeenCalledWith('Outliers (> 2 SD): 2');
      expect(consoleSpy).toHaveBeenCalledWith('Outlier states: CA, NY');
      expect(consoleSpy).toHaveBeenCalledWith('Replaced with median: 50.00');
    });

    it('should log ecommerce score analysis', () => {
      const analysis: OutlierAnalysis = {
        outliers: [],
        median: 45,
        mean: 47.2,
        standardDeviation: 8.1,
        correctedScores: { CA: 50, NY: 45, TX: 46 },
      };

      logOutlierAnalysis(analysis, 'ecommerce');

      expect(consoleSpy).toHaveBeenCalledWith(
        '=== ECOMMERCE SCORE OUTLIER ANALYSIS ===',
      );
      expect(consoleSpy).toHaveBeenCalledWith('Mean: 47.20');
      expect(consoleSpy).toHaveBeenCalledWith('Median: 45.00');
      expect(consoleSpy).toHaveBeenCalledWith('Standard Deviation: 8.10');
      expect(consoleSpy).toHaveBeenCalledWith('Outliers (> 2 SD): 0');
    });

    it('should handle analysis with no outliers', () => {
      const analysis: OutlierAnalysis = {
        outliers: [],
        median: 50,
        mean: 52.1,
        standardDeviation: 5.3,
        correctedScores: { CA: 55, NY: 50, TX: 51 },
      };

      logOutlierAnalysis(analysis, 'physical');

      expect(consoleSpy).toHaveBeenCalledWith('Outliers (> 2 SD): 0');
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Outlier states:'),
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Replaced with median:'),
      );
    });
  });
});
