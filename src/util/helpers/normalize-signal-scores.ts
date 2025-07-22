/**
 * Normalize a set of scores to a 0-100 scale using min-max normalization.
 * If all values are the same, returns 100 for all.
 * Optionally, min and max can be overridden for consistent scaling across signals.
 *
 * @param scores - Record of state to score
 * @param minOverride - Optional minimum value to use for normalization
 * @param maxOverride - Optional maximum value to use for normalization
 * @returns Record of state to normalized score (0-100)
 */
export function normalizeScores(
  scores: Record<string, number>,
  minOverride?: number,
  maxOverride?: number,
): Record<string, number> {
  const values = Object.values(scores);
  const min = minOverride !== undefined ? minOverride : Math.min(...values);
  const max = maxOverride !== undefined ? maxOverride : Math.max(...values);

  // Avoid division by zero...

  if (max === min) {
    return Object.fromEntries(Object.keys(scores).map((k) => [k, 100]));
  }

  return Object.fromEntries(
    Object.entries(scores).map(([state, value]) => [
      state,
      Math.round((100 * (value - min)) / (max - min)),
    ]),
  );
}
