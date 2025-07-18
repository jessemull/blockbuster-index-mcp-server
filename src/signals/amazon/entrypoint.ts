import { getAmazonScores } from './get-amazon-scores';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    logger.info('Starting Amazon signal task...');
    const scores = await getAmazonScores();
    const calculatedAt = new Date().toISOString();
    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../../dev/scores');
      const filePath = path.join(scoresDir, 'amazon-scores.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ scores, calculatedAt }, null, 2),
      );
      logger.info('Amazon scores written to file', { filePath });
    } else {
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/amazon-scores.json',
        body: JSON.stringify({ scores, calculatedAt }, null, 2),
        metadata: { calculatedAt, signal: 'AMAZON' },
      });
      logger.info('Amazon scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/amazon-scores.json',
      });
    }
    logger.info('SUCCESS: Amazon signal task completed successfully!');
  } catch (err) {
    logger.error('Amazon signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
