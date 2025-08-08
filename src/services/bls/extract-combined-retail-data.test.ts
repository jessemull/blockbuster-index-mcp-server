import { extractCombinedRetailDataFromCsv } from './extract-combined-retail-data';
import { BlsCsvRecord, BlsStateData } from '../../types/bls';
import { aggregateRecordData } from './aggregate-record-data';
import { classifyIndustry } from './classify-industry';
import { convertToStateData } from './convert-to-state-data';
import { isValidStateRecord } from './valid-state-record';
import { logger } from '../../util';

jest.mock('./aggregate-record-data');
jest.mock('./classify-industry');
jest.mock('./convert-to-state-data');
jest.mock('./valid-state-record');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('extractCombinedRetailDataFromCsv', () => {
  const mockAggregateRecordData = aggregateRecordData as jest.MockedFunction<
    typeof aggregateRecordData
  >;
  const mockClassifyIndustry = classifyIndustry as jest.MockedFunction<
    typeof classifyIndustry
  >;
  const mockConvertToStateData = convertToStateData as jest.MockedFunction<
    typeof convertToStateData
  >;
  const mockIsValidStateRecord = isValidStateRecord as jest.MockedFunction<
    typeof isValidStateRecord
  >;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  const createMockRecord = (
    areaFips: string,
    industryCode: string,
  ): BlsCsvRecord => ({
    area_fips: areaFips,
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockAggregateRecordData.mockReturnValue(1);
    mockClassifyIndustry.mockReturnValue({
      isECommerce: false,
      isBrickAndMortarRetail: true,
    });
    mockConvertToStateData.mockReturnValue([]);
  });

  describe('Basic functionality', () => {
    it('should process valid records and return state data', () => {
      const records = [
        createMockRecord('06000', '442110'),
        createMockRecord('48000', '443142'),
      ];
      const year = 2020;

      mockIsValidStateRecord
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'CA', retailLq: 1.5 })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'TX', retailLq: 2.0 });

      mockClassifyIndustry
        .mockReturnValueOnce({
          isECommerce: false,
          isBrickAndMortarRetail: true,
        })
        .mockReturnValueOnce({
          isECommerce: true,
          isBrickAndMortarRetail: false,
        });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
        {
          state: 'TX',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toEqual(expectedStateData);
      expect(mockIsValidStateRecord).toHaveBeenCalledTimes(2);
      expect(mockClassifyIndustry).toHaveBeenCalledTimes(2);
      expect(mockAggregateRecordData).toHaveBeenCalledTimes(2);
      expect(mockConvertToStateData).toHaveBeenCalledTimes(1);
    });

    it('should handle empty records array', () => {
      const records: BlsCsvRecord[] = [];
      const year = 2020;

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toEqual([]);
      expect(mockIsValidStateRecord).not.toHaveBeenCalled();
      expect(mockClassifyIndustry).not.toHaveBeenCalled();
      expect(mockAggregateRecordData).not.toHaveBeenCalled();
      expect(mockConvertToStateData).toHaveBeenCalledWith({}, 2020);
    });

    it('should skip invalid records', () => {
      const records = [
        createMockRecord('06000', '442110'),
        createMockRecord('48000', '443142'),
        createMockRecord('99999', '999999'),
      ];
      const year = 2020;

      mockIsValidStateRecord
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'CA', retailLq: 1.5 })
        .mockReturnValueOnce({ isValid: false })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'TX', retailLq: 2.0 });

      mockClassifyIndustry
        .mockReturnValueOnce({
          isECommerce: false,
          isBrickAndMortarRetail: true,
        })
        .mockReturnValueOnce({
          isECommerce: true,
          isBrickAndMortarRetail: false,
        });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
        {
          state: 'TX',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toEqual(expectedStateData);
      expect(mockIsValidStateRecord).toHaveBeenCalledTimes(3);
      expect(mockClassifyIndustry).toHaveBeenCalledTimes(2);
      expect(mockAggregateRecordData).toHaveBeenCalledTimes(2);
    });
  });

  describe('Record processing and aggregation', () => {
    it('should call aggregateRecordData with correct parameters', () => {
      const records = [createMockRecord('06000', '442110')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: true,
        isBrickAndMortarRetail: false,
      });

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockAggregateRecordData).toHaveBeenCalledWith(
        expect.any(Object),
        'CA',
        records[0],
        1.5,
        false,
        true,
      );
    });

    it('should accumulate valid records count correctly', () => {
      const records = [
        createMockRecord('06000', '442110'),
        createMockRecord('48000', '443142'),
        createMockRecord('36000', '446110'),
      ];
      const year = 2020;

      mockIsValidStateRecord
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'CA', retailLq: 1.5 })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'TX', retailLq: 2.0 })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'NY', retailLq: 1.8 });

      mockClassifyIndustry
        .mockReturnValueOnce({
          isECommerce: false,
          isBrickAndMortarRetail: true,
        })
        .mockReturnValueOnce({
          isECommerce: true,
          isBrickAndMortarRetail: false,
        })
        .mockReturnValueOnce({
          isECommerce: true,
          isBrickAndMortarRetail: true,
        });

      mockAggregateRecordData
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2);

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockAggregateRecordData).toHaveBeenCalledTimes(3);
    });

    it('should handle records with zero valid records returned from aggregation', () => {
      const records = [createMockRecord('06000', '442110')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: false,
        isBrickAndMortarRetail: false,
      });

      mockAggregateRecordData.mockReturnValue(0);

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockAggregateRecordData).toHaveBeenCalledWith(
        expect.any(Object),
        'CA',
        records[0],
        1.5,
        false,
        false,
      );
    });
  });

  describe('State data conversion', () => {
    it('should call convertToStateData with aggregated data and year', () => {
      const records = [createMockRecord('06000', '442110')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: false,
        isBrickAndMortarRetail: true,
      });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(mockConvertToStateData).toHaveBeenCalledWith(
        expect.any(Object),
        year,
      );
      expect(result).toEqual(expectedStateData);
    });

    it('should handle empty aggregated data', () => {
      const records = [createMockRecord('99999', '999999')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: false,
      });

      mockConvertToStateData.mockReturnValue([]);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(mockConvertToStateData).toHaveBeenCalledWith({}, year);
      expect(result).toEqual([]);
    });
  });

  describe('Logging functionality', () => {
    it('should log info when state data is generated', () => {
      const records = [createMockRecord('06000', '442110')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: false,
        isBrickAndMortarRetail: true,
      });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Extracted 1 combined retail records for year 2020 (1 valid records from 1 total)',
      );
    });

    it('should not log when no state data is generated', () => {
      const records = [createMockRecord('99999', '999999')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: false,
      });

      mockConvertToStateData.mockReturnValue([]);

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should log correct counts for mixed valid and invalid records', () => {
      const records = [
        createMockRecord('06000', '442110'),
        createMockRecord('99999', '999999'),
        createMockRecord('48000', '443142'),
      ];
      const year = 2020;

      mockIsValidStateRecord
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'CA', retailLq: 1.5 })
        .mockReturnValueOnce({ isValid: false })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'TX', retailLq: 2.0 });

      mockClassifyIndustry
        .mockReturnValueOnce({
          isECommerce: false,
          isBrickAndMortarRetail: true,
        })
        .mockReturnValueOnce({
          isECommerce: true,
          isBrickAndMortarRetail: false,
        });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
        {
          state: 'TX',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Extracted 2 combined retail records for year 2020 (2 valid records from 3 total)',
      );
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle records with undefined state abbreviation', () => {
      const records = [createMockRecord('99999', '999999')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: undefined,
        retailLq: 1.5,
      });

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockAggregateRecordData).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        records[0],
        1.5,
        true,
        false,
      );
    });

    it('should handle records with undefined retail LQ', () => {
      const records = [createMockRecord('99999', '999999')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: undefined,
      });

      extractCombinedRetailDataFromCsv(records, year);

      expect(mockAggregateRecordData).toHaveBeenCalledWith(
        expect.any(Object),
        'CA',
        records[0],
        undefined,
        true,
        false,
      );
    });

    it('should handle large number of records', () => {
      const records = Array.from({ length: 1000 }, () =>
        createMockRecord('06000', '442110'),
      );
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: false,
        isBrickAndMortarRetail: true,
      });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toEqual(expectedStateData);
      expect(mockIsValidStateRecord).toHaveBeenCalledTimes(1000);
      expect(mockClassifyIndustry).toHaveBeenCalledTimes(1000);
      expect(mockAggregateRecordData).toHaveBeenCalledTimes(1000);
    });

    it('should handle records with various industry classifications', () => {
      const records = [
        createMockRecord('06000', '442110'),
        createMockRecord('48000', '454110'),
        createMockRecord('36000', '999999'),
      ];
      const year = 2020;

      mockIsValidStateRecord
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'CA', retailLq: 1.5 })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'TX', retailLq: 2.0 })
        .mockReturnValueOnce({ isValid: true, stateAbbr: 'NY', retailLq: 1.8 });

      mockClassifyIndustry
        .mockReturnValueOnce({
          isECommerce: false,
          isBrickAndMortarRetail: true,
        })
        .mockReturnValueOnce({
          isECommerce: true,
          isBrickAndMortarRetail: false,
        })
        .mockReturnValueOnce({
          isECommerce: false,
          isBrickAndMortarRetail: false,
        });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
        {
          state: 'TX',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
        {
          state: 'NY',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toEqual(expectedStateData);
      expect(mockAggregateRecordData).toHaveBeenCalledTimes(3);
    });
  });

  describe('Return value validation', () => {
    it('should return BlsStateData array', () => {
      const records = [createMockRecord('06000', '442110')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: false,
        isBrickAndMortarRetail: true,
      });

      const expectedStateData: BlsStateData[] = [
        {
          state: 'CA',
          year: 2020,
          timestamp: 1234567890,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ];
      mockConvertToStateData.mockReturnValue(expectedStateData);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(expectedStateData);
    });

    it('should return empty array when no valid records', () => {
      const records = [createMockRecord('99999', '999999')];
      const year = 2020;

      mockIsValidStateRecord.mockReturnValue({
        isValid: false,
      });

      mockConvertToStateData.mockReturnValue([]);

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toEqual([]);
    });
  });

  describe('Function signature and behavior', () => {
    it('should accept BlsCsvRecord array and year number', () => {
      const records: BlsCsvRecord[] = [];
      const year = 2020;

      const result = extractCombinedRetailDataFromCsv(records, year);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should not modify the original records array', () => {
      const records = [createMockRecord('06000', '442110')];
      const year = 2020;
      const originalRecords = JSON.parse(JSON.stringify(records));

      mockIsValidStateRecord.mockReturnValue({
        isValid: false,
      });

      extractCombinedRetailDataFromCsv(records, year);

      expect(records).toEqual(originalRecords);
    });

    it('should handle different year values', () => {
      const records = [createMockRecord('06000', '442110')];
      const years = [2020, 2021, 2022, 1990, 2030];

      mockIsValidStateRecord.mockReturnValue({
        isValid: true,
        stateAbbr: 'CA',
        retailLq: 1.5,
      });

      mockClassifyIndustry.mockReturnValue({
        isECommerce: false,
        isBrickAndMortarRetail: true,
      });

      years.forEach((year) => {
        mockConvertToStateData.mockReturnValue([]);
        extractCombinedRetailDataFromCsv(records, year);
        expect(mockConvertToStateData).toHaveBeenCalledWith(
          expect.any(Object),
          year,
        );
      });
    });
  });
});
