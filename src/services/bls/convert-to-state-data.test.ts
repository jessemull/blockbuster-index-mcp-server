import { convertToStateData } from './convert-to-state-data';

describe('convertToStateData', () => {
  const mockDate = new Date('2023-01-01T12:00:00Z');

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic conversion functionality', () => {
    it('should convert single state data correctly', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5, '443142': 2.0 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        state: 'CA',
        year: 2020,
        timestamp: Math.floor(mockDate.getTime() / 1000),
        brickAndMortarCodes: { '442110': 1.5, '443142': 2.0 },
        ecommerceCodes: { '454110': 3.2 },
      });
    });

    it('should convert multiple states data correctly', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
        TX: {
          brickAndMortarCodes: { '443142': 2.0 },
          ecommerceCodes: { '454111': 2.8 },
        },
        NY: {
          brickAndMortarCodes: { '446110': 1.8 },
          ecommerceCodes: { '454112': 4.1 },
        },
      };
      const year = 2021;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        {
          state: 'CA',
          year: 2021,
          timestamp: Math.floor(mockDate.getTime() / 1000),
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
        {
          state: 'TX',
          year: 2021,
          timestamp: Math.floor(mockDate.getTime() / 1000),
          brickAndMortarCodes: { '443142': 2.0 },
          ecommerceCodes: { '454111': 2.8 },
        },
        {
          state: 'NY',
          year: 2021,
          timestamp: Math.floor(mockDate.getTime() / 1000),
          brickAndMortarCodes: { '446110': 1.8 },
          ecommerceCodes: { '454112': 4.1 },
        },
      ]);
    });
  });

  describe('Empty and edge cases', () => {
    it('should handle empty state aggregated data', () => {
      const stateAggregatedData = {};
      const year = 2022;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle states with empty brick and mortar codes', () => {
      const stateAggregatedData = {
        WA: {
          brickAndMortarCodes: {},
          ecommerceCodes: { '454110': 5.2 },
        },
      };
      const year = 2023;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        state: 'WA',
        year: 2023,
        timestamp: Math.floor(mockDate.getTime() / 1000),
        brickAndMortarCodes: {},
        ecommerceCodes: { '454110': 5.2 },
      });
    });

    it('should handle states with empty ecommerce codes', () => {
      const stateAggregatedData = {
        OR: {
          brickAndMortarCodes: { '442110': 1.2, '443142': 1.8 },
          ecommerceCodes: {},
        },
      };
      const year = 2024;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        state: 'OR',
        year: 2024,
        timestamp: Math.floor(mockDate.getTime() / 1000),
        brickAndMortarCodes: { '442110': 1.2, '443142': 1.8 },
        ecommerceCodes: {},
      });
    });

    it('should handle states with both empty codes', () => {
      const stateAggregatedData = {
        ID: {
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      };
      const year = 2025;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        state: 'ID',
        year: 2025,
        timestamp: Math.floor(mockDate.getTime() / 1000),
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      });
    });
  });

  describe('Data preservation', () => {
    it('should preserve all brick and mortar codes', () => {
      const stateAggregatedData = {
        FL: {
          brickAndMortarCodes: {
            '442110': 1.5,
            '443142': 2.1,
            '446110': 1.8,
            '448150': 2.3,
            '451110': 1.9,
          },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].brickAndMortarCodes).toEqual({
        '442110': 1.5,
        '443142': 2.1,
        '446110': 1.8,
        '448150': 2.3,
        '451110': 1.9,
      });
    });

    it('should preserve all ecommerce codes', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: {
            '454110': 3.2,
            '454111': 2.8,
            '454112': 4.1,
          },
        },
      };
      const year = 2021;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].ecommerceCodes).toEqual({
        '454110': 3.2,
        '454111': 2.8,
        '454112': 4.1,
      });
    });

    it('should preserve decimal values', () => {
      const stateAggregatedData = {
        NV: {
          brickAndMortarCodes: { '442110': 1.234567 },
          ecommerceCodes: { '454110': 2.987654 },
        },
      };
      const year = 2022;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].brickAndMortarCodes['442110']).toBe(1.234567);
      expect(result[0].ecommerceCodes['454110']).toBe(2.987654);
    });

    it('should preserve zero values', () => {
      const stateAggregatedData = {
        MT: {
          brickAndMortarCodes: { '442110': 0 },
          ecommerceCodes: { '454110': 0 },
        },
      };
      const year = 2023;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].brickAndMortarCodes['442110']).toBe(0);
      expect(result[0].ecommerceCodes['454110']).toBe(0);
    });

    it('should preserve negative values', () => {
      const stateAggregatedData = {
        WY: {
          brickAndMortarCodes: { '442110': -1.5 },
          ecommerceCodes: { '454110': -2.0 },
        },
      };
      const year = 2024;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].brickAndMortarCodes['442110']).toBe(-1.5);
      expect(result[0].ecommerceCodes['454110']).toBe(-2.0);
    });
  });

  describe('Timestamp generation', () => {
    it('should generate current timestamp for all records', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
        TX: {
          brickAndMortarCodes: { '443142': 2.0 },
          ecommerceCodes: { '454111': 2.8 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);
      const expectedTimestamp = Math.floor(mockDate.getTime() / 1000);

      expect(result[0].timestamp).toBe(expectedTimestamp);
      expect(result[1].timestamp).toBe(expectedTimestamp);
    });

    it('should use floor division for timestamp', () => {
      const mockTime = 1640995200123;
      jest.spyOn(Date, 'now').mockReturnValue(mockTime);

      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].timestamp).toBe(Math.floor(mockTime / 1000));
    });
  });

  describe('Year parameter handling', () => {
    it('should handle positive years', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2025;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].year).toBe(2025);
    });

    it('should handle zero year', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 0;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].year).toBe(0);
    });

    it('should handle negative years', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = -2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].year).toBe(-2020);
    });

    it('should handle large year values', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 9999;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].year).toBe(9999);
    });
  });

  describe('State name handling', () => {
    it('should handle single character state names', () => {
      const stateAggregatedData = {
        A: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].state).toBe('A');
    });

    it('should handle long state names', () => {
      const stateAggregatedData = {
        VERY_LONG_STATE_NAME: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].state).toBe('VERY_LONG_STATE_NAME');
    });

    it('should handle state names with special characters', () => {
      const stateAggregatedData = {
        'CA-1': {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].state).toBe('CA-1');
    });

    it('should handle numeric state names', () => {
      const stateAggregatedData = {
        '123': {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].state).toBe('123');
    });
  });

  describe('Return value structure', () => {
    it('should return array of BlsStateData objects', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('state');
      expect(result[0]).toHaveProperty('year');
      expect(result[0]).toHaveProperty('timestamp');
      expect(result[0]).toHaveProperty('brickAndMortarCodes');
      expect(result[0]).toHaveProperty('ecommerceCodes');
    });

    it('should maintain object reference integrity', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result[0].brickAndMortarCodes).toBe(
        stateAggregatedData.CA.brickAndMortarCodes,
      );
      expect(result[0].ecommerceCodes).toBe(
        stateAggregatedData.CA.ecommerceCodes,
      );
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept state aggregated data and year parameters', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;

      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should not modify the original state aggregated data', () => {
      const stateAggregatedData = {
        CA: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: { '454110': 3.2 },
        },
      };
      const year = 2020;
      const originalData = JSON.parse(JSON.stringify(stateAggregatedData));

      convertToStateData(stateAggregatedData, year);

      expect(stateAggregatedData).toEqual(originalData);
    });

    it('should handle all 50 states plus territories', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

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
        stateAggregatedData[state] = {
          brickAndMortarCodes: { '442110': 1.0 },
          ecommerceCodes: { '454110': 2.0 },
        };
      });

      const year = 2020;
      const result = convertToStateData(stateAggregatedData, year);

      expect(result).toHaveLength(53);
      states.forEach((state, index) => {
        expect(result[index].state).toBe(state);
        expect(result[index].year).toBe(2020);
      });
    });
  });
});
