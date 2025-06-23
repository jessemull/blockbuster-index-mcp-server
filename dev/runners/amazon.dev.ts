import fs from 'fs/promises';
import path from 'path';
import { getAmazonScores } from '../../src/signals';

(async () => {
  const scoresDir = path.resolve(__dirname, '../scores');
  const file = path.join(scoresDir, 'amazon-scores.json');

  await fs.mkdir(scoresDir, { recursive: true });

  const scores = await getAmazonScores();
  await fs.writeFile(file, JSON.stringify(scores, null, 2));
  console.log(`Amazon signal written to: ${file}`);
})();
