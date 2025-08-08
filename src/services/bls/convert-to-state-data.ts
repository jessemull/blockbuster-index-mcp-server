import { BlsStateData } from '../../types/bls';

export function convertToStateData(
  stateAggregatedData: Record<
    string,
    {
      brickAndMortarCodes: Record<string, number>;
      ecommerceCodes: Record<string, number>;
    }
  >,
  year: number,
): BlsStateData[] {
  const stateData: BlsStateData[] = [];

  for (const [state, aggregatedData] of Object.entries(stateAggregatedData)) {
    const stateDataRecord: BlsStateData = {
      state,
      year,
      timestamp: Math.floor(Date.now() / 1000),
      brickAndMortarCodes: aggregatedData.brickAndMortarCodes,
      ecommerceCodes: aggregatedData.ecommerceCodes,
    };
    stateData.push(stateDataRecord);
  }

  return stateData;
}
