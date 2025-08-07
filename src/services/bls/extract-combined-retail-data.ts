import { BlsCsvRecord, BlsStateData } from 'types/bls';
import { aggregateRecordData } from './aggregate-record-data';
import { classifyIndustry } from './classify-industry';
import { convertToStateData } from './convert-to-state-data';
import { isValidStateRecord } from './valid-state-record';
import { logger } from '../../util';

export function extractCombinedRetailDataFromCsv(
  records: BlsCsvRecord[],
  year: number,
): BlsStateData[] {
  const stateAggregatedData: Record<
    string,
    {
      brickAndMortarCodes: Record<string, number>;
      ecommerceCodes: Record<string, number>;
    }
  > = {};

  let processedRecords = 0;
  let validRecords = 0;

  for (const record of records) {
    processedRecords++;

    const validation = isValidStateRecord(record);
    if (!validation.isValid) {
      continue;
    }

    const { stateAbbr, retailLq } = validation;
    const { isECommerce, isBrickAndMortarRetail } = classifyIndustry(record);

    const newValidRecords = aggregateRecordData(
      stateAggregatedData,
      stateAbbr!,
      record,
      retailLq!,
      isBrickAndMortarRetail,
      isECommerce,
    );
    validRecords += newValidRecords;
  }

  const stateData = convertToStateData(stateAggregatedData, year);

  if (stateData.length > 0) {
    logger.info(
      `Extracted ${stateData.length} combined retail records for year ${year} (${validRecords} valid records from ${processedRecords} total)`,
    );
  }
  return stateData;
}
