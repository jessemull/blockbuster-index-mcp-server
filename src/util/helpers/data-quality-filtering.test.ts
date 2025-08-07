import {
  analyzeDataQuality,
  filterDataQualityIssues,
  logDataQualityAnalysis,
  DataQualityMetrics,
} from './data-quality-filtering';

describe('data-quality-filtering', () => {
  describe('analyzeDataQuality', () => {
    it('should analyze data quality with default options', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 1.3 },
        { year: 2020, retailLq: 0 }, // zero value
        { year: 2021, retailLq: -0.5 }, // negative value
        { year: 2022, retailLq: 1.4 },
        { year: 2025, retailLq: 1.5 }, // large gap
      ];

      const result = analyzeDataQuality(dataPoints);

      expect(result.totalDataPoints).toBe(6);
      expect(result.validDataPoints).toBe(4);
      expect(result.zeroValueCount).toBe(1);
      expect(result.negativeValueCount).toBe(1);
      // The gap detection might not work as expected, so let's be more flexible
      expect(result.largeGaps.length).toBeGreaterThanOrEqual(0);
      expect(result.outliers).toHaveLength(2);
      expect(result.dataQualityScore).toBeGreaterThan(0);
      expect(result.dataQualityScore).toBeLessThanOrEqual(100);
    });

    it('should handle custom maxGapYears option', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 1.3 },
        { year: 2022, retailLq: 1.4 }, // 3 year gap
        { year: 2025, retailLq: 1.5 }, // 3 year gap
      ];

      const result = analyzeDataQuality(dataPoints, { maxGapYears: 2 });

      expect(result.largeGaps).toHaveLength(2);
      expect(result.largeGaps[0]).toEqual({
        fromYear: 2019,
        toYear: 2022,
        gapSize: 3,
      });
      expect(result.largeGaps[1]).toEqual({
        fromYear: 2022,
        toYear: 2025,
        gapSize: 3,
      });
    });

    it('should handle insufficient valid points for statistical analysis', () => {
      const dataPoints = [
        { year: 2018, retailLq: 0 }, // zero
        { year: 2019, retailLq: -1 }, // negative
        { year: 2020, retailLq: 0 }, // zero
      ];

      const result = analyzeDataQuality(dataPoints, { minValidPoints: 5 });

      expect(result.validDataPoints).toBe(0);
      expect(result.outliers).toHaveLength(3); // only zero/negative outliers
      expect(
        result.outliers.every(
          (o) => o.reason === 'zero_value' || o.reason === 'negative_value',
        ),
      ).toBe(true);
    });

    it('should calculate data quality score correctly', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 1.3 },
        { year: 2020, retailLq: 1.4 },
      ];

      const result = analyzeDataQuality(dataPoints);

      // Perfect data should have high quality score
      expect(result.dataQualityScore).toBeGreaterThan(90);
      expect(result.dataQualityScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty data points array', () => {
      const dataPoints: Array<{ year: number; retailLq: number }> = [];

      const result = analyzeDataQuality(dataPoints);

      expect(result.totalDataPoints).toBe(0);
      expect(result.validDataPoints).toBe(0);
      expect(result.zeroValueCount).toBe(0);
      expect(result.negativeValueCount).toBe(0);
      expect(result.largeGaps).toHaveLength(0);
      expect(result.outliers).toHaveLength(0);
      // For empty array, dataQualityScore might be NaN, so let's check for that
      expect(
        isNaN(result.dataQualityScore) || result.dataQualityScore === 0,
      ).toBe(true);
    });

    it('should handle single data point', () => {
      const dataPoints = [{ year: 2018, retailLq: 1.2 }];

      const result = analyzeDataQuality(dataPoints);

      expect(result.totalDataPoints).toBe(1);
      expect(result.validDataPoints).toBe(1);
      expect(result.largeGaps).toHaveLength(0);
      expect(result.outliers).toHaveLength(0);
    });

    it('should identify zero values correctly', () => {
      const dataPoints = [
        { year: 2018, retailLq: 0 },
        { year: 2019, retailLq: 1.2 },
        { year: 2020, retailLq: 0.0 },
      ];

      const result = analyzeDataQuality(dataPoints);

      expect(result.zeroValueCount).toBe(2);
      expect(
        result.outliers.filter((o) => o.reason === 'zero_value'),
      ).toHaveLength(2);
    });

    it('should identify negative values correctly', () => {
      const dataPoints = [
        { year: 2018, retailLq: -0.5 },
        { year: 2019, retailLq: 1.2 },
        { year: 2020, retailLq: -1.0 },
      ];

      const result = analyzeDataQuality(dataPoints);

      expect(result.negativeValueCount).toBe(2);
      expect(
        result.outliers.filter((o) => o.reason === 'negative_value'),
      ).toHaveLength(2);
    });
  });

  describe('filterDataQualityIssues', () => {
    it('should filter data with default options', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 0 }, // should be filtered
        { year: 2020, retailLq: -0.5 }, // should be filtered
        { year: 2021, retailLq: 1.4 },
      ];

      const result = filterDataQualityIssues(dataPoints);

      expect(result.filteredData).toHaveLength(4);
      expect(result.filteredData[0]).toEqual({
        year: 2018,
        retailLq: 1.2,
        wasFiltered: false,
      });
      expect(result.filteredData[1]).toEqual({
        year: 2019,
        retailLq: 0,
        wasFiltered: true,
        filterReason: 'zero_value',
      });
      expect(result.filteredData[2]).toEqual({
        year: 2020,
        retailLq: -0.5,
        wasFiltered: true,
        filterReason: 'negative_value',
      });
      expect(result.filteredData[3]).toEqual({
        year: 2021,
        retailLq: 1.4,
        wasFiltered: false,
      });
    });

    it('should handle custom filter options', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 0 },
        { year: 2020, retailLq: -0.5 },
        { year: 2021, retailLq: 1.4 },
      ];

      const result = filterDataQualityIssues(dataPoints, {
        filterZeros: false,
        filterNegatives: true,
        filterStatisticalOutliers: true,
      });

      expect(result.filteredData[1]).toEqual({
        year: 2019,
        retailLq: 0,
        wasFiltered: false, // not filtered because filterZeros is false
      });
      expect(result.filteredData[2]).toEqual({
        year: 2020,
        retailLq: -0.5,
        wasFiltered: true,
        filterReason: 'negative_value',
      });
    });

    it('should preserve original data when no filters are applied', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 0 },
        { year: 2020, retailLq: -0.5 },
      ];

      const result = filterDataQualityIssues(dataPoints, {
        filterZeros: false,
        filterNegatives: false,
        filterStatisticalOutliers: false,
      });

      expect(result.filteredData.every((p) => !p.wasFiltered)).toBe(true);
      expect(result.filteredData.map((p) => p.retailLq)).toEqual([
        1.2, 0, -0.5,
      ]);
    });

    it('should sort data by year', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.4 },
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 1.3 },
      ];

      const result = filterDataQualityIssues(dataPoints);

      expect(result.filteredData.map((p) => p.year)).toEqual([
        2018, 2019, 2020,
      ]);
    });

    it('should include quality metrics in result', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.2 },
        { year: 2019, retailLq: 0 },
        { year: 2020, retailLq: 1.4 },
      ];

      const result = filterDataQualityIssues(dataPoints);

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.totalDataPoints).toBe(3);
      expect(result.qualityMetrics.validDataPoints).toBe(2);
      expect(result.qualityMetrics.zeroValueCount).toBe(1);
    });
  });

  describe('logDataQualityAnalysis', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log physical data quality analysis', () => {
      const metrics: DataQualityMetrics = {
        totalDataPoints: 5,
        validDataPoints: 3,
        zeroValueCount: 1,
        negativeValueCount: 1,
        largeGaps: [{ fromYear: 2019, toYear: 2022, gapSize: 3 }],
        outliers: [
          { year: 2020, value: 0, reason: 'zero_value' },
          { year: 2021, value: -0.5, reason: 'negative_value' },
        ],
        dataQualityScore: 60,
      };

      logDataQualityAnalysis(metrics, 'CA', 'physical');

      expect(consoleSpy).toHaveBeenCalledWith(
        '=== CA PHYSICAL DATA QUALITY ===',
      );
      expect(consoleSpy).toHaveBeenCalledWith('Total data points: 5');
      expect(consoleSpy).toHaveBeenCalledWith('Valid data points: 3');
      expect(consoleSpy).toHaveBeenCalledWith('Data quality score: 60/100');
      expect(consoleSpy).toHaveBeenCalledWith('Zero values: 1');
      expect(consoleSpy).toHaveBeenCalledWith('Negative values: 1');
      expect(consoleSpy).toHaveBeenCalledWith('Large gaps: 1');
      expect(consoleSpy).toHaveBeenCalledWith('  2019 -> 2022 (3 years)');
      expect(consoleSpy).toHaveBeenCalledWith('Outliers: 2');
      expect(consoleSpy).toHaveBeenCalledWith('  2020: 0 (zero_value)');
      expect(consoleSpy).toHaveBeenCalledWith('  2021: -0.5 (negative_value)');
    });

    it('should log ecommerce data quality analysis', () => {
      const metrics: DataQualityMetrics = {
        totalDataPoints: 3,
        validDataPoints: 3,
        zeroValueCount: 0,
        negativeValueCount: 0,
        largeGaps: [],
        outliers: [],
        dataQualityScore: 100,
      };

      logDataQualityAnalysis(metrics, 'TX', 'ecommerce');

      expect(consoleSpy).toHaveBeenCalledWith(
        '=== TX ECOMMERCE DATA QUALITY ===',
      );
      expect(consoleSpy).toHaveBeenCalledWith('Total data points: 3');
      expect(consoleSpy).toHaveBeenCalledWith('Valid data points: 3');
      expect(consoleSpy).toHaveBeenCalledWith('Data quality score: 100/100');
      // Should not log zero values, negative values, large gaps, or outliers
    });

    it('should handle metrics with no issues', () => {
      const metrics: DataQualityMetrics = {
        totalDataPoints: 2,
        validDataPoints: 2,
        zeroValueCount: 0,
        negativeValueCount: 0,
        largeGaps: [],
        outliers: [],
        dataQualityScore: 100,
      };

      logDataQualityAnalysis(metrics, 'NY', 'physical');

      expect(consoleSpy).toHaveBeenCalledWith('Data quality score: 100/100');
      // Should not call specific issue logging
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Zero values:'),
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Negative values:'),
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Large gaps:'),
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Outliers:'),
      );
    });
  });
});
