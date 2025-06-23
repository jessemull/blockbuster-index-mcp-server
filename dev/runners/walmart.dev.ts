import fs from 'fs/promises';
import path from 'path';
import { getWalmartScores } from '../../src/signals';

(async () => {
  const scoresDir = path.resolve(__dirname, '../scores');
  const file = path.join(scoresDir, 'walmart-scores.json');

  await fs.mkdir(scoresDir, { recursive: true });

  const scores = await getWalmartScores();
  await fs.writeFile(file, JSON.stringify(scores, null, 2));
  console.log(`Walmart signal written to: ${file}`);
})();
