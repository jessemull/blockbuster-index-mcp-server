import fs from 'fs/promises';
import path from 'path';
import { getCommerceScores } from '../../src/signals';

(async () => {
  const scoresDir = path.resolve(__dirname, '../scores');
  const file = path.join(scoresDir, 'ecommerce-scores.json');

  await fs.mkdir(scoresDir, { recursive: true });

  const scores = await getCommerceScores();
  await fs.writeFile(file, JSON.stringify(scores, null, 2));
  console.log(`E-commerce signal written to: ${file}`);
})();
