import { getBroadbandScores } from './get-broadband-scores';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    logger.info('Starting Broadband signal task...');
    const scores = await getBroadbandScores();
    const calculatedAt = new Date().toISOString();
    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../../dev/scores');
      const filePath = path.join(scoresDir, 'broadband-scores.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ scores, calculatedAt }, null, 2),
      );
      logger.info('Broadband scores written to file', { filePath });
    } else {
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/broadband-scores.json',
        body: JSON.stringify({ scores, calculatedAt }, null, 2),
        metadata: { calculatedAt, signal: 'BROADBAND' },
      });
      logger.info('Broadband scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/broadband-scores.json',
      });
    }
    logger.info('Broadband signal task completed!');
  } catch (err) {
    logger.error('Broadband signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
