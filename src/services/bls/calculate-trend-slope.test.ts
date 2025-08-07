import { calculateTrendSlope } from './calculate-trend-slope';

describe('calculateTrendSlope', () => {
  describe('Insufficient data scenarios', () => {
    it('should return 0 for empty data points array', () => {
      const result = calculateTrendSlope([]);
      expect(result).toBe(0);
    });

    it('should return 0 for single data point', () => {
      const dataPoints = [{ year: 2020, retailLq: 1.5 }];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBe(0);
    });

    it('should return 0 when all data points have zero or negative values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 0 },
        { year: 2021, retailLq: -1.5 },
        { year: 2022, retailLq: 0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBe(0);
    });

    it('should return 0 when only one valid data point remains after filtering', () => {
      const dataPoints = [
        { year: 2020, retailLq: 0 },
        { year: 2021, retailLq: 1.5 },
        { year: 2022, retailLq: -1.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBe(0);
    });
  });

  describe('Data sorting and filtering', () => {
    it('should sort data points by year in ascending order', () => {
      const dataPoints = [
        { year: 2022, retailLq: 2.0 },
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 1.5 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.5, 3);
    });

    it('should filter out zero and negative values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 0 },
        { year: 2022, retailLq: 2.0 },
        { year: 2023, retailLq: -1.5 },
        { year: 2024, retailLq: 3.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.5, 3);
    });

    it('should handle mixed valid and invalid data points', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 0 },
        { year: 2022, retailLq: 2.0 },
        { year: 2023, retailLq: -1.0 },
        { year: 2024, retailLq: 3.0 },
        { year: 2025, retailLq: 0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.5, 3);
    });
  });

  describe('Year normalization', () => {
    it('should normalize years to start from 0', () => {
      const dataPoints = [
        { year: 2018, retailLq: 1.0 },
        { year: 2019, retailLq: 1.5 },
        { year: 2020, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.5, 3);
    });

    it('should handle large year values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 1.5 },
        { year: 2022, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.5, 3);
    });

    it('should handle very large year values', () => {
      const dataPoints = [
        { year: 2000, retailLq: 1.0 },
        { year: 2010, retailLq: 1.5 },
        { year: 2020, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.05, 3);
    });
  });

  describe('Linear regression calculations', () => {
    it('should calculate positive slope correctly', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 1.5 },
        { year: 2022, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.5, 3);
    });

    it('should calculate negative slope correctly', () => {
      const dataPoints = [
        { year: 2020, retailLq: 3.0 },
        { year: 2021, retailLq: 2.5 },
        { year: 2022, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(-0.5, 3);
    });

    it('should calculate zero slope for flat data', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.5 },
        { year: 2021, retailLq: 1.5 },
        { year: 2022, retailLq: 1.5 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0, 3);
    });

    it('should handle non-linear data with linear approximation', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 2.0 },
        { year: 2022, retailLq: 1.5 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.25, 3);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle minimum valid data points', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(1.0, 3);
    });

    it('should handle decimal values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.234 },
        { year: 2021, retailLq: 2.567 },
        { year: 2022, retailLq: 3.891 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(1.3285, 3);
    });

    it('should handle very small values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 0.001 },
        { year: 2021, retailLq: 0.002 },
        { year: 2022, retailLq: 0.003 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.001, 3);
    });

    it('should handle very large values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1000.0 },
        { year: 2021, retailLq: 2000.0 },
        { year: 2022, retailLq: 3000.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(1000.0, 3);
    });

    it('should handle mixed decimal and integer values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.5 },
        { year: 2021, retailLq: 2 },
        { year: 2022, retailLq: 2.75 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.625, 3);
    });
  });

  describe('Mathematical edge cases', () => {
    it('should handle identical years with different values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2020, retailLq: 2.0 },
        { year: 2021, retailLq: 3.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(1.5, 3);
    });

    it('should handle single year with multiple values', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2020, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeNaN();
    });

    it('should handle floating point precision issues', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0000000000000001 },
        { year: 2021, retailLq: 2.0000000000000001 },
        { year: 2022, retailLq: 3.0000000000000001 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(1.0, 3);
    });
  });

  describe('Return value validation', () => {
    it('should return a number', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(typeof result).toBe('number');
    });

    it('should return finite numbers', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 2.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle potential division by zero scenarios', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2020, retailLq: 1.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeNaN();
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept array of data points and return number', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 2.0 },
        { year: 2022, retailLq: 3.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(typeof result).toBe('number');
    });

    it('should not modify the original data points array', () => {
      const originalDataPoints = [
        { year: 2022, retailLq: 2.0 },
        { year: 2020, retailLq: 1.0 },
        { year: 2021, retailLq: 1.5 },
      ];
      const dataPointsCopy = [...originalDataPoints];
      calculateTrendSlope(dataPointsCopy);
      expect(dataPointsCopy).toEqual(originalDataPoints);
    });

    it('should handle data points with non-sequential years', () => {
      const dataPoints = [
        { year: 2020, retailLq: 1.0 },
        { year: 2025, retailLq: 2.0 },
        { year: 2030, retailLq: 3.0 },
      ];
      const result = calculateTrendSlope(dataPoints);
      expect(result).toBeCloseTo(0.2, 3);
    });
  });
});
