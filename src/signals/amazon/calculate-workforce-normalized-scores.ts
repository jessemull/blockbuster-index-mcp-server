import { CensusWorkforceData } from '../../types';

export function calculateWorkforceNormalizedScores(
  jobCounts: Record<string, number>,
  workforceData: CensusWorkforceData,
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const [state, jobCount] of Object.entries(jobCounts)) {
    const workforceSize = workforceData[state] || 0;

    if (workforceSize > 0) {
      const jobsPer1000Workers = Math.round((jobCount / workforceSize) * 1000);
      scores[state] = jobsPer1000Workers;
    } else {
      scores[state] = 0;
    }
  }

  return scores;
}

export default calculateWorkforceNormalizedScores;
