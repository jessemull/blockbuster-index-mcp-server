import fs from 'fs/promises';
import path from 'path';
import { getStreamingScores } from '../../src/signals';

(async () => {
  const scoresDir = path.resolve(__dirname, '../scores');
  const file = path.join(scoresDir, 'streaming-scores.json');

  await fs.mkdir(scoresDir, { recursive: true });

  const scores = await getStreamingScores();
  await fs.writeFile(file, JSON.stringify(scores, null, 2));
  console.log(`Streaming signal written to: ${file}`);
})();
