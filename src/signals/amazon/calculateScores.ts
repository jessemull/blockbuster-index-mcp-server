export function calculateScores(
  jobCounts: Record<string, number>,
): Record<string, number> {
  const maxJobs = Math.max(...Object.values(jobCounts));
  const minJobs = Math.min(...Object.values(jobCounts));
  const scores: Record<string, number> = {};
  for (const [state, jobCount] of Object.entries(jobCounts)) {
    if (maxJobs === minJobs) {
      scores[state] = 0.1;
    } else {
      const normalizedScore =
        ((jobCount - minJobs) / (maxJobs - minJobs)) * 0.15 + 0.05;
      scores[state] = parseFloat(normalizedScore.toFixed(2));
    }
  }
  return scores;
}
export default calculateScores;
