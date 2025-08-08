import { BlsCsvRecord } from 'types/bls';
import { STATE_FIPS_CODES } from '../../constants';

export function isValidStateRecord(record: BlsCsvRecord): {
  isValid: boolean;
  stateAbbr?: string;
  retailLq?: number;
} {
  // Check if this is state-level data (area_fips ends with 000)...

  if (!record.area_fips.endsWith('000')) {
    return { isValid: false };
  }

  const stateAbbr = STATE_FIPS_CODES[record.area_fips];

  if (!stateAbbr) {
    return { isValid: false };
  }

  const retailLq = parseFloat(record.lq_annual_avg_emplvl);

  if (isNaN(retailLq) || retailLq <= 0) {
    return { isValid: false };
  }

  return { isValid: true, stateAbbr, retailLq };
}
