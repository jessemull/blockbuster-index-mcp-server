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
       * Jobs as a percentage of state workforce, scaled by 1,000,000 for
       * readable integer scores: (jobs / workforce) * 100 * 1,000,000.
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
