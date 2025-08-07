import { aggregateRecordData } from './aggregate-record-data';
import { BlsCsvRecord } from '../../types/bls';

describe('aggregateRecordData', () => {
  const createMockRecord = (industryCode: string): BlsCsvRecord => ({
    area_fips: '12345',
    own_code: '5',
    agglvl_code: '70',
    size_code: '001',
    industry_code: industryCode,
    year: '2020',
    annual_avg_emplvl: '1000',
    annual_avg_estabs: '50',
    total_annual_wages: '50000000',
    taxable_annual_wages: '45000000',
    annual_contributions: '1000000',
    annual_avg_wkly_wage: '1000',
    avg_annual_pay: '52000',
    lq_annual_avg_emplvl: '1.5',
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

  describe('State data initialization', () => {
    it('should initialize state data when it does not exist', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('442110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'CA',
        record,
        1.5,
        true,
        false,
      );

      expect(stateAggregatedData['CA']).toBeDefined();
      expect(stateAggregatedData['CA'].brickAndMortarCodes).toEqual({
        '442110': 1.5,
      });
      expect(stateAggregatedData['CA'].ecommerceCodes).toEqual({});
      expect(result).toBe(1);
    });

    it('should not reinitialize existing state data', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {
        CA: {
          brickAndMortarCodes: { '442110': 2.0 },
          ecommerceCodes: { '454110': 1.0 },
        },
      };

      const record = createMockRecord('443142');
      const result = aggregateRecordData(
        stateAggregatedData,
        'CA',
        record,
        1.5,
        true,
        false,
      );

      expect(stateAggregatedData['CA'].brickAndMortarCodes['442110']).toBe(2.0);
      expect(stateAggregatedData['CA'].brickAndMortarCodes['443142']).toBe(1.5);
      expect(stateAggregatedData['CA'].ecommerceCodes['454110']).toBe(1.0);
      expect(result).toBe(1);
    });
  });

  describe('Brick and mortar retail aggregation', () => {
    it('should aggregate brick and mortar retail data correctly', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('442110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'TX',
        record,
        2.5,
        true,
        false,
      );

      expect(stateAggregatedData['TX'].brickAndMortarCodes['442110']).toBe(2.5);
      expect(stateAggregatedData['TX'].ecommerceCodes).toEqual({});
      expect(result).toBe(1);
    });

    it('should accumulate brick and mortar retail data for same industry code', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {
        NY: {
          brickAndMortarCodes: { '442110': 1.5 },
          ecommerceCodes: {},
        },
      };

      const record = createMockRecord('442110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'NY',
        record,
        2.0,
        true,
        false,
      );

      expect(stateAggregatedData['NY'].brickAndMortarCodes['442110']).toBe(3.5);
      expect(result).toBe(1);
    });

    it('should initialize brick and mortar code if not exists', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {
        FL: {
          brickAndMortarCodes: { '442110': 1.0 },
          ecommerceCodes: {},
        },
      };

      const record = createMockRecord('443142');
      const result = aggregateRecordData(
        stateAggregatedData,
        'FL',
        record,
        1.8,
        true,
        false,
      );

      expect(stateAggregatedData['FL'].brickAndMortarCodes['442110']).toBe(1.0);
      expect(stateAggregatedData['FL'].brickAndMortarCodes['443142']).toBe(1.8);
      expect(result).toBe(1);
    });
  });

  describe('E-commerce aggregation', () => {
    it('should aggregate e-commerce data correctly', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('454110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'WA',
        record,
        3.2,
        false,
        true,
      );

      expect(stateAggregatedData['WA'].ecommerceCodes['454110']).toBe(3.2);
      expect(stateAggregatedData['WA'].brickAndMortarCodes).toEqual({});
      expect(result).toBe(1);
    });

    it('should accumulate e-commerce data for same industry code', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {
        CA: {
          brickAndMortarCodes: {},
          ecommerceCodes: { '454110': 2.1 },
        },
      };

      const record = createMockRecord('454110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'CA',
        record,
        1.9,
        false,
        true,
      );

      expect(stateAggregatedData['CA'].ecommerceCodes['454110']).toBe(4.0);
      expect(result).toBe(1);
    });

    it('should initialize e-commerce code if not exists', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {
        OR: {
          brickAndMortarCodes: {},
          ecommerceCodes: { '454110': 1.5 },
        },
      };

      const record = createMockRecord('454111');
      const result = aggregateRecordData(
        stateAggregatedData,
        'OR',
        record,
        2.3,
        false,
        true,
      );

      expect(stateAggregatedData['OR'].ecommerceCodes['454110']).toBe(1.5);
      expect(stateAggregatedData['OR'].ecommerceCodes['454111']).toBe(2.3);
      expect(result).toBe(1);
    });
  });

  describe('Dual classification scenarios', () => {
    it('should handle record classified as both brick and mortar and e-commerce', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('454112');
      const result = aggregateRecordData(
        stateAggregatedData,
        'NV',
        record,
        2.0,
        true,
        true,
      );

      expect(stateAggregatedData['NV'].brickAndMortarCodes['454112']).toBe(2.0);
      expect(stateAggregatedData['NV'].ecommerceCodes['454112']).toBe(2.0);
      expect(result).toBe(2);
    });

    it('should handle record classified as neither brick and mortar nor e-commerce', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('999999');
      const result = aggregateRecordData(
        stateAggregatedData,
        'ID',
        record,
        1.0,
        false,
        false,
      );

      expect(stateAggregatedData['ID']).toBeDefined();
      expect(stateAggregatedData['ID'].brickAndMortarCodes).toEqual({});
      expect(stateAggregatedData['ID'].ecommerceCodes).toEqual({});
      expect(result).toBe(0);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle zero retail LQ values', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('442110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'MT',
        record,
        0,
        true,
        false,
      );

      expect(stateAggregatedData['MT'].brickAndMortarCodes['442110']).toBe(0);
      expect(result).toBe(1);
    });

    it('should handle negative retail LQ values', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('443142');
      const result = aggregateRecordData(
        stateAggregatedData,
        'WY',
        record,
        -1.5,
        true,
        false,
      );

      expect(stateAggregatedData['WY'].brickAndMortarCodes['443142']).toBe(
        -1.5,
      );
      expect(result).toBe(1);
    });

    it('should handle very large retail LQ values', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('446110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'AK',
        record,
        999.99,
        true,
        false,
      );

      expect(stateAggregatedData['AK'].brickAndMortarCodes['446110']).toBe(
        999.99,
      );
      expect(result).toBe(1);
    });

    it('should handle decimal retail LQ values', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('448150');
      const result = aggregateRecordData(
        stateAggregatedData,
        'VT',
        record,
        1.234567,
        true,
        false,
      );

      expect(stateAggregatedData['VT'].brickAndMortarCodes['448150']).toBe(
        1.234567,
      );
      expect(result).toBe(1);
    });
  });

  describe('Return value validation', () => {
    it('should return correct number of valid records processed', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('451110');
      const result = aggregateRecordData(
        stateAggregatedData,
        'NH',
        record,
        1.5,
        true,
        true,
      );

      expect(result).toBe(2);
    });

    it('should return zero when no valid classifications', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('999999');
      const result = aggregateRecordData(
        stateAggregatedData,
        'ME',
        record,
        1.0,
        false,
        false,
      );

      expect(result).toBe(0);
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept all required parameters and return number', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record = createMockRecord('452210');
      const result = aggregateRecordData(
        stateAggregatedData,
        'ND',
        record,
        1.2,
        true,
        false,
      );

      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple states independently', () => {
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      const record1 = createMockRecord('442110');
      const record2 = createMockRecord('443142');

      aggregateRecordData(stateAggregatedData, 'CA', record1, 1.5, true, false);
      aggregateRecordData(stateAggregatedData, 'TX', record2, 2.0, true, false);

      expect(stateAggregatedData['CA'].brickAndMortarCodes['442110']).toBe(1.5);
      expect(stateAggregatedData['TX'].brickAndMortarCodes['443142']).toBe(2.0);
      expect(
        stateAggregatedData['CA'].brickAndMortarCodes['443142'],
      ).toBeUndefined();
      expect(
        stateAggregatedData['TX'].brickAndMortarCodes['442110'],
      ).toBeUndefined();
    });
  });
});
