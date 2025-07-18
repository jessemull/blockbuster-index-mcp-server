import { getCensusScores } from './get-census-scores';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    logger.info('Starting Census signal task...');
    const scores = await getCensusScores();
    const calculatedAt = new Date().toISOString();
    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../../dev/scores');
      const filePath = path.join(scoresDir, 'census-scores.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ scores, calculatedAt }, null, 2),
      );
      logger.info('Census scores written to file', { filePath });
    } else {
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/census-scores.json',
        body: JSON.stringify({ scores, calculatedAt }, null, 2),
        metadata: { calculatedAt, signal: 'CENSUS' },
      });
      logger.info('Census scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/census-scores.json',
      });
    }
    logger.info('SUCCESS: Census signal task completed successfully!');
  } catch (err) {
    logger.error('Census signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
