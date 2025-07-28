import { getBlsScores } from './get-bls-scores';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    logger.info('Starting BLS signal task...');
    const scores = await getBlsScores();
    const calculatedAt = new Date().toISOString();
    const timestamp = Math.floor(Date.now() / 1000);

    // Store scores in DynamoDB for historical tracking...

    if (
      !CONFIG.IS_DEVELOPMENT &&
      process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME
    ) {
      try {
        const { DynamoDBSignalScoresRepository } = await import(
          '../../repositories'
        );
        const signalScoresRepository = new DynamoDBSignalScoresRepository(
          process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
        );

        await signalScoresRepository.save({
          signalType: 'bls',
          timestamp,
          calculatedAt,
          scores,
        });

        logger.info('BLS scores stored in DynamoDB', {
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
          timestamp,
        });
      } catch (dbError) {
        // Continue with S3 upload even if DynamoDB fails...

        logger.error('Failed to store BLS scores in DynamoDB', {
          error: dbError,
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
        });
      }
    }

    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../../dev/scores');
      const filePath = path.join(scoresDir, 'bls-scores.json');

      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ scores, calculatedAt }, null, 2),
      );

      logger.info('BLS scores written to file', { filePath });
    } else {
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/bls-scores.json',
        body: JSON.stringify({ scores, calculatedAt }, null, 2),
        metadata: { calculatedAt, signal: 'BLS' },
      });

      logger.info('BLS scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/bls-scores.json',
      });
    }

    logger.info('SUCCESS: BLS signal task completed successfully!');
  } catch (err) {
    logger.error('BLS signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
