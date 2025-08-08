import { validateStateData } from './validate-state-data';
import { BlsStateData } from '../../types/bls';
import { logger } from '../../util';

jest.mock('../../util', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('validateStateData', () => {
  const mockLogger = logger as jest.Mocked<typeof logger>;

  const createMockStateData = (
    overrides: Partial<BlsStateData> = {},
  ): BlsStateData => ({
    state: 'CA',
    year: 2020,
    timestamp: 1234567890,
    brickAndMortarCodes: { '442110': 1.5 },
    ecommerceCodes: { '454110': 2.0 },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('State validation', () => {
    it('should return true for valid state string', () => {
      const data = createMockStateData({ state: 'CA' });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return false for missing state', () => {
      const data = createMockStateData({ state: '' });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should return false for undefined state', () => {
      const data = createMockStateData({ state: undefined as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should return false for null state', () => {
      const data = createMockStateData({ state: null as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should return false for non-string state', () => {
      const data = createMockStateData({ state: 123 as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should return false for boolean state', () => {
      const data = createMockStateData({ state: true as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should return false for object state', () => {
      const data = createMockStateData({ state: {} as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should handle single character state names', () => {
      const data = createMockStateData({ state: 'A' });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle long state names', () => {
      const data = createMockStateData({ state: 'VERY_LONG_STATE_NAME' });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Year validation', () => {
    it('should return true for valid year number', () => {
      const data = createMockStateData({ year: 2020 });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return false for missing year', () => {
      const data = createMockStateData({ year: 0 });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should return false for undefined year', () => {
      const data = createMockStateData({ year: undefined as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should return false for null year', () => {
      const data = createMockStateData({ year: null as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should return false for non-number year', () => {
      const data = createMockStateData({ year: '2020' as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should return false for boolean year', () => {
      const data = createMockStateData({ year: true as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should return false for object year', () => {
      const data = createMockStateData({ year: {} as any });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should handle negative years', () => {
      const data = createMockStateData({ year: -2020 });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle very large years', () => {
      const data = createMockStateData({ year: 9999 });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle decimal years', () => {
      const data = createMockStateData({ year: 2020.5 });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Code data validation', () => {
    it('should return true when both brick and mortar and ecommerce data exist', () => {
      const data = createMockStateData({
        brickAndMortarCodes: { '442110': 1.5, '443142': 2.0 },
        ecommerceCodes: { '454110': 2.0, '454111': 1.8 },
      });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return true when only brick and mortar data exists', () => {
      const data = createMockStateData({
        brickAndMortarCodes: { '442110': 1.5, '443142': 2.0 },
        ecommerceCodes: {},
      });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return true when only ecommerce data exists', () => {
      const data = createMockStateData({
        brickAndMortarCodes: {},
        ecommerceCodes: { '454110': 2.0, '454111': 1.8 },
      });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return false when both brick and mortar and ecommerce data are empty', () => {
      const data = createMockStateData({
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No valid code data in state data',
        { data },
      );
    });

    it('should handle brick and mortar codes with various data types', () => {
      const testCases = [
        { codes: { '442110': 1.5 }, expected: true },
        { codes: { '442110': 0 }, expected: true },
        { codes: { '442110': -1.5 }, expected: true },
        { codes: { '442110': 1.234567 }, expected: true },
        { codes: { '442110': 999999.999999 }, expected: true },
      ];

      testCases.forEach(({ codes, expected }) => {
        const data = createMockStateData({
          brickAndMortarCodes: codes,
          ecommerceCodes: {},
        });
        const result = validateStateData(data);

        expect(result).toBe(expected);
        if (expected) {
          expect(mockLogger.warn).not.toHaveBeenCalled();
          expect(mockLogger.info).not.toHaveBeenCalled();
        } else {
          expect(mockLogger.info).toHaveBeenCalledWith(
            'No valid code data in state data',
            { data },
          );
        }
      });
    });

    it('should handle ecommerce codes with various data types', () => {
      const testCases = [
        { codes: { '454110': 2.0 }, expected: true },
        { codes: { '454110': 0 }, expected: true },
        { codes: { '454110': -2.0 }, expected: true },
        { codes: { '454110': 2.987654 }, expected: true },
        { codes: { '454110': 999999.999999 }, expected: true },
      ];

      testCases.forEach(({ codes, expected }) => {
        const data = createMockStateData({
          brickAndMortarCodes: {},
          ecommerceCodes: codes,
        });
        const result = validateStateData(data);

        expect(result).toBe(expected);
        if (expected) {
          expect(mockLogger.warn).not.toHaveBeenCalled();
          expect(mockLogger.info).not.toHaveBeenCalled();
        } else {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            'No valid code data in state data',
            { data },
          );
        }
      });
    });
  });

  describe('Combined validation scenarios', () => {
    it('should return false when state is invalid but year and codes are valid', () => {
      const data = createMockStateData({ state: '' });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should return false when year is invalid but state and codes are valid', () => {
      const data = createMockStateData({ year: 0 });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should return false when codes are invalid but state and year are valid', () => {
      const data = createMockStateData({
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No valid code data in state data',
        { data },
      );
    });

    it('should return true when all validations pass', () => {
      const data = createMockStateData({
        state: 'CA',
        year: 2020,
        brickAndMortarCodes: { '442110': 1.5 },
        ecommerceCodes: { '454110': 2.0 },
      });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very large code objects', () => {
      const largeBrickAndMortarCodes: Record<string, number> = {};
      const largeEcommerceCodes: Record<string, number> = {};

      for (let i = 0; i < 1000; i++) {
        largeBrickAndMortarCodes[`442${i.toString().padStart(3, '0')}`] =
          Math.random();
        largeEcommerceCodes[`454${i.toString().padStart(3, '0')}`] =
          Math.random();
      }

      const data = createMockStateData({
        brickAndMortarCodes: largeBrickAndMortarCodes,
        ecommerceCodes: largeEcommerceCodes,
      });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle empty string state', () => {
      const data = createMockStateData({ state: '' });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should handle whitespace-only state', () => {
      const data = createMockStateData({ state: '   ' });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle zero year', () => {
      const data = createMockStateData({ year: 0 });
      const result = validateStateData(data);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should handle negative year', () => {
      const data = createMockStateData({ year: -2020 });
      const result = validateStateData(data);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Logging behavior', () => {
    it('should log warning with data object when state is invalid', () => {
      const data = createMockStateData({ state: '' });
      validateStateData(data);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state in data', {
        data,
      });
    });

    it('should log warning with data object when year is invalid', () => {
      const data = createMockStateData({ year: 0 });
      validateStateData(data);

      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid year in data', {
        data,
      });
    });

    it('should log info with data object when codes are invalid', () => {
      const data = createMockStateData({
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      });
      validateStateData(data);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No valid code data in state data',
        { data },
      );
    });

    it('should not log when all validations pass', () => {
      const data = createMockStateData();
      validateStateData(data);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Return value validation', () => {
    it('should return boolean value', () => {
      const data = createMockStateData();
      const result = validateStateData(data);

      expect(typeof result).toBe('boolean');
    });

    it('should return true for valid data', () => {
      const data = createMockStateData();
      const result = validateStateData(data);

      expect(result).toBe(true);
    });

    it('should return false for invalid data', () => {
      const data = createMockStateData({ state: '' });
      const result = validateStateData(data);

      expect(result).toBe(false);
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept BlsStateData parameter', () => {
      const data = createMockStateData();
      const result = validateStateData(data);

      expect(result).toBeDefined();
    });

    it('should not modify the original data object', () => {
      const data = createMockStateData();
      const originalData = { ...data };

      validateStateData(data);

      expect(data).toEqual(originalData);
    });

    it('should handle all 50 states plus territories', () => {
      const states = [
        'AL',
        'AK',
        'AZ',
        'AR',
        'CA',
        'CO',
        'CT',
        'DE',
        'FL',
        'GA',
        'HI',
        'ID',
        'IL',
        'IN',
        'IA',
        'KS',
        'KY',
        'LA',
        'ME',
        'MD',
        'MA',
        'MI',
        'MN',
        'MS',
        'MO',
        'MT',
        'NE',
        'NV',
        'NH',
        'NJ',
        'NM',
        'NY',
        'NC',
        'ND',
        'OH',
        'OK',
        'OR',
        'PA',
        'RI',
        'SC',
        'SD',
        'TN',
        'TX',
        'UT',
        'VT',
        'VA',
        'WA',
        'WV',
        'WI',
        'WY',
        'DC',
        'PR',
        'VI',
      ];

      states.forEach((state) => {
        const data = createMockStateData({ state });
        const result = validateStateData(data);

        expect(result).toBe(true);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });
  });
});
