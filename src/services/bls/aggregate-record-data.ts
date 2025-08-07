import { BlsCsvRecord } from '../../types/bls';

export function aggregateRecordData(
  stateAggregatedData: Record<
    string,
    {
      brickAndMortarCodes: Record<string, number>;
      ecommerceCodes: Record<string, number>;
    }
  >,
  stateAbbr: string,
  record: BlsCsvRecord,
  retailLq: number,
  isBrickAndMortarRetail: boolean,
  isECommerce: boolean,
): number {
  // Initialize state data if not exists...

  if (!stateAggregatedData[stateAbbr]) {
    stateAggregatedData[stateAbbr] = {
      brickAndMortarCodes: {},
      ecommerceCodes: {},
    };
  }

  let validRecords = 0;

  // Add to appropriate category...

  if (isBrickAndMortarRetail) {
    if (
      !stateAggregatedData[stateAbbr].brickAndMortarCodes[record.industry_code]
    ) {
      stateAggregatedData[stateAbbr].brickAndMortarCodes[record.industry_code] =
        0;
    }
    stateAggregatedData[stateAbbr].brickAndMortarCodes[record.industry_code] +=
      retailLq;
    validRecords++;
  }

  if (isECommerce) {
    if (!stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code]) {
      stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code] = 0;
    }
    stateAggregatedData[stateAbbr].ecommerceCodes[record.industry_code] +=
      retailLq;
    validRecords++;
  }

  return validRecords;
}
