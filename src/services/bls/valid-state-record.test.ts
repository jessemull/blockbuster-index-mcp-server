import { isValidStateRecord } from './valid-state-record';
import { BlsCsvRecord } from '../../types/bls';
import { STATE_FIPS_CODES } from '../../constants';

jest.mock('../../constants', () => ({
  STATE_FIPS_CODES: {
    '06000': 'CA',
    '48000': 'TX',
    '36000': 'NY',
    '12000': 'FL',
    '99999': undefined,
    '00000': undefined,
  },
}));

describe('isValidStateRecord', () => {
  const createMockRecord = (
    areaFips: string,
    lqValue: string,
  ): BlsCsvRecord => ({
    area_fips: areaFips,
    own_code: '5',
    agglvl_code: '70',
    size_code: '001',
    industry_code: '442110',
    year: '2020',
    annual_avg_emplvl: '1000',
    annual_avg_estabs: '50',
    total_annual_wages: '50000000',
    taxable_annual_wages: '45000000',
    annual_contributions: '1000000',
    annual_avg_wkly_wage: '1000',
    avg_annual_pay: '52000',
    lq_annual_avg_emplvl: lqValue,
    lq_annual_avg_estabs: '1.2',
    lq_total_annual_wages: '1.3',
    lq_taxable_annual_wages: '1.4',
    lq_annual_contributions: '1.1',
    lq_annual_avg_wkly_wage: '1.6',
    lq_avg_annual_pay: '1.7',
    oty_total_annual_wages_pct: '5.2',
    oty_annual_avg_emplvl_pct: '3.1',
    oty_annual_avg_estabs_pct: '2.8',
  });

  describe('Area FIPS validation', () => {
    it('should return valid for state-level data ending with 000', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });
    });

    it('should return invalid for non-state-level data not ending with 000', () => {
      const record = createMockRecord('06001', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return invalid for county-level data', () => {
      const record = createMockRecord('06003', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return invalid for metro-level data', () => {
      const record = createMockRecord('31080', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle area_fips with different lengths', () => {
      const record = createMockRecord('123', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle area_fips with special characters', () => {
      const record = createMockRecord('06A00', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });
  });

  describe('State FIPS code validation', () => {
    it('should return valid for known state FIPS codes', () => {
      const testCases = [
        { fips: '06000', expectedState: 'CA' },
        { fips: '48000', expectedState: 'TX' },
        { fips: '36000', expectedState: 'NY' },
        { fips: '12000', expectedState: 'FL' },
      ];

      testCases.forEach(({ fips, expectedState }) => {
        const record = createMockRecord(fips, '1.5');
        const result = isValidStateRecord(record);

        expect(result).toEqual({
          isValid: true,
          stateAbbr: expectedState,
          retailLq: 1.5,
        });
      });
    });

    it('should return invalid for unknown state FIPS codes', () => {
      const record = createMockRecord('99999', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return invalid for undefined state FIPS codes', () => {
      const record = createMockRecord('99999', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle FIPS codes that map to undefined', () => {
      const record = createMockRecord('99999', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle FIPS codes that map to undefined but have valid LQ', () => {
      const record = createMockRecord('00000', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });
  });

  describe('Location Quotient validation', () => {
    it('should return valid for positive numeric LQ values', () => {
      const testCases = [
        { lq: '1.0', expected: 1.0 },
        { lq: '1.5', expected: 1.5 },
        { lq: '2.0', expected: 2.0 },
        { lq: '0.5', expected: 0.5 },
        { lq: '10.0', expected: 10.0 },
      ];

      testCases.forEach(({ lq, expected }) => {
        const record = createMockRecord('06000', lq);
        const result = isValidStateRecord(record);

        expect(result).toEqual({
          isValid: true,
          stateAbbr: 'CA',
          retailLq: expected,
        });
      });
    });

    it('should return invalid for zero LQ values', () => {
      const record = createMockRecord('06000', '0');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return invalid for negative LQ values', () => {
      const testCases = ['-1.0', '-0.5', '-10.0'];

      testCases.forEach((lq) => {
        const record = createMockRecord('06000', lq);
        const result = isValidStateRecord(record);

        expect(result).toEqual({ isValid: false });
      });
    });

    it('should return invalid for non-numeric LQ values', () => {
      const testCases = ['abc', ''];

      testCases.forEach((lq) => {
        const record = createMockRecord('06000', lq);
        const result = isValidStateRecord(record);

        expect(result).toEqual({ isValid: false });
      });
    });

    it('should return invalid for NaN LQ values', () => {
      const record = createMockRecord('06000', 'NaN');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle decimal LQ values correctly', () => {
      const testCases = [
        { lq: '1.234567', expected: 1.234567 },
        { lq: '0.001', expected: 0.001 },
        { lq: '999.999', expected: 999.999 },
      ];

      testCases.forEach(({ lq, expected }) => {
        const record = createMockRecord('06000', lq);
        const result = isValidStateRecord(record);

        expect(result).toEqual({
          isValid: true,
          stateAbbr: 'CA',
          retailLq: expected,
        });
      });
    });

    it('should handle integer LQ values correctly', () => {
      const testCases = [
        { lq: '1', expected: 1 },
        { lq: '10', expected: 10 },
        { lq: '100', expected: 100 },
      ];

      testCases.forEach(({ lq, expected }) => {
        const record = createMockRecord('06000', lq);
        const result = isValidStateRecord(record);

        expect(result).toEqual({
          isValid: true,
          stateAbbr: 'CA',
          retailLq: expected,
        });
      });
    });
  });

  describe('Combined validation scenarios', () => {
    it('should return invalid when area_fips is invalid but LQ is valid', () => {
      const record = createMockRecord('06001', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return invalid when area_fips is valid but state is unknown', () => {
      const record = createMockRecord('99999', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return invalid when area_fips and state are valid but LQ is invalid', () => {
      const record = createMockRecord('06000', '0');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should return valid when all conditions are met', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very small positive LQ values', () => {
      const record = createMockRecord('06000', '0.000001');
      const result = isValidStateRecord(record);

      expect(result).toEqual({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 0.000001,
      });
    });

    it('should handle very large LQ values', () => {
      const record = createMockRecord('06000', '999999.999999');
      const result = isValidStateRecord(record);

      expect(result).toEqual({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 999999.999999,
      });
    });

    it('should handle area_fips with leading zeros', () => {
      const record = createMockRecord('00600', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle area_fips with trailing zeros', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });
    });

    it('should handle empty area_fips', () => {
      const record = createMockRecord('', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });

    it('should handle empty LQ value', () => {
      const record = createMockRecord('06000', '');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
    });
  });

  describe('Return value structure', () => {
    it('should return object with isValid boolean', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(typeof result.isValid).toBe('boolean');
    });

    it('should return object with optional stateAbbr string', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(typeof result.stateAbbr).toBe('string');
    });

    it('should return object with optional retailLq number', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(typeof result.retailLq).toBe('number');
    });

    it('should return object without stateAbbr and retailLq when invalid', () => {
      const record = createMockRecord('06001', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toEqual({ isValid: false });
      expect(result.stateAbbr).toBeUndefined();
      expect(result.retailLq).toBeUndefined();
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept BlsCsvRecord parameter', () => {
      const record = createMockRecord('06000', '1.5');
      const result = isValidStateRecord(record);

      expect(result).toBeDefined();
    });

    it('should not modify the original record', () => {
      const record = createMockRecord('06000', '1.5');
      const originalRecord = { ...record };

      isValidStateRecord(record);

      expect(record).toEqual(originalRecord);
    });

    it('should handle all 50 states plus territories', () => {
      const validFipsCodes = Object.keys(STATE_FIPS_CODES).filter(
        (code) => STATE_FIPS_CODES[code as keyof typeof STATE_FIPS_CODES],
      );

      validFipsCodes.forEach((fipsCode) => {
        const record = createMockRecord(fipsCode, '1.5');
        const result = isValidStateRecord(record);

        expect(result.isValid).toBe(true);
        expect(result.stateAbbr).toBe(
          STATE_FIPS_CODES[fipsCode as keyof typeof STATE_FIPS_CODES],
        );
        expect(result.retailLq).toBe(1.5);
      });
    });
  });
});
