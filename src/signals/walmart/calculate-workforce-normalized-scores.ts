import { CensusWorkforceData } from '../../types';

export function calculateWorkforceNormalizedScores(
  jobCounts: Record<string, number>,
  workforceData: CensusWorkforceData,
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const [state, jobCount] of Object.entries(jobCounts)) {
    const workforceSize = workforceData[state] || 0;

    if (workforceSize > 0) {
      /**
       * 1. Calculate percentage of workforce that Walmart jobs represent.
       * 2. Scale by 1,000,000 to get meaningful scores.
       * E.g. (jobs / workforce) * 100 * 1,000,000 = jobs_percentage * 1,000,000.
       */
      const percentageOfWorkforce = (jobCount / workforceSize) * 100;
      const scaledScore = Math.round(percentageOfWorkforce * 1000000);
      scores[state] = scaledScore;
    } else {
      scores[state] = 0;
    }
  }

  return scores;
}

export default calculateWorkforceNormalizedScores;
