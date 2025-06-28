import { States } from '../../types';

export function getEqualScores(): Record<string, number> {
  const scores: Record<string, number> = {};
  Object.values(States).forEach((state) => {
    scores[state] = 0.1;
  });
  return scores;
}

export default getEqualScores;
