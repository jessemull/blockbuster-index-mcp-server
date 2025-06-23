import fs from 'fs/promises';
import path from 'path';
import { getBroadbandScores } from '../../src/signals';

(async () => {
  const scoresDir = path.resolve(__dirname, '../scores');
  const file = path.join(scoresDir, 'broadband-scores.json');

  await fs.mkdir(scoresDir, { recursive: true });

  const scores = await getBroadbandScores();
  await fs.writeFile(file, JSON.stringify(scores, null, 2));
  console.log(`Broadband signal written to: ${file}`);
})();
