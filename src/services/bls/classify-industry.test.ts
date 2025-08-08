import { classifyIndustry } from './classify-industry';
import { BlsCsvRecord } from '../../types/bls';

describe('classifyIndustry', () => {
  const createMockRecord = (industryCode: string): BlsCsvRecord => ({
    area_fips: '06000',
    industry_code: industryCode,
    own_code: '5',
    agglvl_code: '70',
    size_code: '001',
    year: '2020',
    annual_avg_emplvl: '1000',
    annual_avg_estabs: '50',
    total_annual_wages: '50000000',
    taxable_annual_wages: '45000000',
    annual_contributions: '5000000',
    annual_avg_wkly_wage: '1000',
    avg_annual_pay: '52000',
    lq_annual_avg_emplvl: '1.0',
    lq_annual_avg_estabs: '1.0',
    lq_total_annual_wages: '1.0',
    lq_taxable_annual_wages: '1.0',
    lq_annual_contributions: '1.0',
    lq_annual_avg_wkly_wage: '1.0',
    lq_avg_annual_pay: '1.0',
    oty_total_annual_wages_pct: '5.0',
    oty_annual_avg_emplvl_pct: '3.0',
    oty_annual_avg_estabs_pct: '2.0',
  });

  describe('E-commerce classification', () => {
    it('should classify e-commerce codes correctly', () => {
      const ecommerceCodes = ['454110', '454111', '454112'];

      ecommerceCodes.forEach((code) => {
        const record = createMockRecord(code);
        const result = classifyIndustry(record);

        expect(result.isECommerce).toBe(true);
        expect(result.isBrickAndMortarRetail).toBe(false);
      });
    });

    it('should classify partial e-commerce codes correctly', () => {
      const record = createMockRecord('454110123');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(true);
      expect(result.isBrickAndMortarRetail).toBe(false);
    });

    it('should not classify non-e-commerce codes as e-commerce', () => {
      const nonEcommerceCodes = [
        '442100',
        '443100',
        '446100',
        '448100',
        '451100',
        '452200',
        '452300',
        '453100',
        '453200',
        '453300',
        '453900',
      ];

      nonEcommerceCodes.forEach((code) => {
        const record = createMockRecord(code);
        const result = classifyIndustry(record);

        expect(result.isECommerce).toBe(false);
      });
    });
  });

  describe('Brick and mortar retail classification', () => {
    it('should classify brick and mortar retail codes correctly', () => {
      const brickAndMortarCodes = [
        '4421',
        '4431',
        '4461',
        '4481',
        '4511',
        '4522',
        '4523',
        '4531',
        '4532',
        '4533',
        '4539',
      ];

      brickAndMortarCodes.forEach((code) => {
        const record = createMockRecord(code);
        const result = classifyIndustry(record);

        expect(result.isBrickAndMortarRetail).toBe(true);
        expect(result.isECommerce).toBe(false);
      });
    });

    it('should classify partial brick and mortar codes correctly', () => {
      const record = createMockRecord('4421123');
      const result = classifyIndustry(record);

      expect(result.isBrickAndMortarRetail).toBe(true);
      expect(result.isECommerce).toBe(false);
    });

    it('should not classify non-brick-and-mortar codes as brick and mortar', () => {
      const nonBrickAndMortarCodes = [
        '454110',
        '454111',
        '454112',
        '441100',
        '444100',
        '445100',
        '447100',
      ];

      nonBrickAndMortarCodes.forEach((code) => {
        const record = createMockRecord(code);
        const result = classifyIndustry(record);

        expect(result.isBrickAndMortarRetail).toBe(false);
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty industry code', () => {
      const record = createMockRecord('');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(false);
      expect(result.isBrickAndMortarRetail).toBe(false);
    });

    it('should handle very short industry codes', () => {
      const record = createMockRecord('4');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(false);
      expect(result.isBrickAndMortarRetail).toBe(false);
    });

    it('should handle very long industry codes', () => {
      const record = createMockRecord('454110123456789');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(true);
      expect(result.isBrickAndMortarRetail).toBe(false);
    });

    it('should handle codes that are not in either category', () => {
      const otherCodes = ['441100', '444100', '445100', '447100', '999999'];

      otherCodes.forEach((code) => {
        const record = createMockRecord(code);
        const result = classifyIndustry(record);

        expect(result.isECommerce).toBe(false);
        expect(result.isBrickAndMortarRetail).toBe(false);
      });
    });

    it('should handle case sensitivity', () => {
      const record = createMockRecord('454110');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(true);
      expect(result.isBrickAndMortarRetail).toBe(false);
    });

    it('should handle whitespace in industry codes', () => {
      const record = createMockRecord(' 454110 ');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(false);
      expect(result.isBrickAndMortarRetail).toBe(false);
    });
  });

  describe('Return value structure', () => {
    it('should return an object with correct properties', () => {
      const record = createMockRecord('454110');
      const result = classifyIndustry(record);

      expect(result).toHaveProperty('isECommerce');
      expect(result).toHaveProperty('isBrickAndMortarRetail');
      expect(typeof result.isECommerce).toBe('boolean');
      expect(typeof result.isBrickAndMortarRetail).toBe('boolean');
    });

    it('should return both properties as booleans', () => {
      const record = createMockRecord('4421');
      const result = classifyIndustry(record);

      expect(result.isECommerce).toBe(false);
      expect(result.isBrickAndMortarRetail).toBe(true);
      expect(typeof result.isECommerce).toBe('boolean');
      expect(typeof result.isBrickAndMortarRetail).toBe('boolean');
    });
  });

  describe('Integration with actual BLS data patterns', () => {
    it('should handle typical BLS industry code format', () => {
      const typicalCodes = [
        '442110',
        '443142',
        '446110',
        '448150',
        '451110',
        '452210',
        '453220',
        '454110',
      ];

      const expectedResults = [
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: false, isBrickAndMortarRetail: true },
        { isECommerce: true, isBrickAndMortarRetail: false },
      ];

      typicalCodes.forEach((code, index) => {
        const record = createMockRecord(code);
        const result = classifyIndustry(record);

        expect(result.isECommerce).toBe(expectedResults[index].isECommerce);
        expect(result.isBrickAndMortarRetail).toBe(
          expectedResults[index].isBrickAndMortarRetail,
        );
      });
    });
  });
});
