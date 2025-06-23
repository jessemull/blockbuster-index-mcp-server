import fs from 'fs/promises';
import path from 'path';
import { getAnalogScores } from '../../src/signals';

(async () => {
  const scoresDir = path.resolve(__dirname, '../scores');
  const file = path.join(scoresDir, 'analog-scores.json');

  await fs.mkdir(scoresDir, { recursive: true });

  const scores = await getAnalogScores();
  await fs.writeFile(file, JSON.stringify(scores, null, 2));
  console.log(`Analog signal written to: ${file}`);
})();
