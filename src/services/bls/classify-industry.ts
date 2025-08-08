import { BLS_INDUSTRY_CODES } from '../../constants';
import { BlsCsvRecord } from '../../types/bls';

export function classifyIndustry(record: BlsCsvRecord): {
  isECommerce: boolean;
  isBrickAndMortarRetail: boolean;
} {
  const isECommerce = BLS_INDUSTRY_CODES.E_COMMERCE_NAICS.some((code) =>
    record.industry_code.startsWith(code),
  );

  const isBrickAndMortarRetail =
    BLS_INDUSTRY_CODES.BRICK_AND_MORTAR_RETAIL_NAICS.some((code) =>
      record.industry_code.startsWith(code),
    );

  return { isECommerce, isBrickAndMortarRetail };
}
