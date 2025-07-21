export function calculateInvertedScores(
  jobCounts: Record<string, number>,
): Record<string, number> {
  const maxJobs = Math.max(...Object.values(jobCounts));
  const minJobs = Math.min(...Object.values(jobCounts));

  const scores: Record<string, number> = {};

  for (const [state, jobCount] of Object.entries(jobCounts)) {
    if (maxJobs === minJobs) {
      scores[state] = 0.1;
      continue;
    }

    // Invert the score: higher job count = lower digital adoption score...

    const normalizedScore =
      ((maxJobs - jobCount) / (maxJobs - minJobs)) * 0.15 + 0.05;

    scores[state] = parseFloat(normalizedScore.toFixed(10));
  }

  return scores;
}
