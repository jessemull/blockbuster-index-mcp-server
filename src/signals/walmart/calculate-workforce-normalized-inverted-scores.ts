import { CensusWorkforceData } from '../../types';

export function calculateWorkforceNormalizedInvertedScores(
  jobCounts: Record<string, number>,
  workforceData: CensusWorkforceData,
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const [state, jobCount] of Object.entries(jobCounts)) {
    const workforceSize = workforceData[state] || 0;

    if (workforceSize > 0) {
      /**
       * 1. Calculate percentage of workforce that Walmart physical jobs represent.
       * 2. Scale by 1,000,000 to get meaningful scores.
       * 3. Invert the score: higher percentage = lower digital adoption score.
       * E.g. (jobs / workforce) * 100 * 1,000,000 = jobs_percentage * 1,000,000.
       */

      const percentageOfWorkforce = (jobCount / workforceSize) * 100;
      const scaledScore = Math.round(percentageOfWorkforce * 1000000);

      // Invert the score: higher physical job percentage = lower digital adoption score
      // We'll use a simple inversion: max possible score - current score
      // Assuming max percentage is around 10% of workforce (1,000,000 * 10 = 10,000,000)
      const maxPossibleScore = 10000000; // 10% of workforce scaled by 1M
      const invertedScore = Math.max(0, maxPossibleScore - scaledScore);

      scores[state] = invertedScore;
    } else {
      scores[state] = 0;
    }
  }

  return scores;
}

export default calculateWorkforceNormalizedInvertedScores;
