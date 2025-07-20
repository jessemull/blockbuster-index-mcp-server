import { getWalmartScores } from './get-walmart-scores';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    logger.info('Starting Walmart signal task...');
    const { physicalScores, technologyScores } = await getWalmartScores();
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

        // Store physical scores
        await signalScoresRepository.save({
          signalType: 'walmart-physical',
          timestamp,
          calculatedAt,
          scores: physicalScores,
        });

        // Store technology scores
        await signalScoresRepository.save({
          signalType: 'walmart-technology',
          timestamp,
          calculatedAt,
          scores: technologyScores,
        });

        logger.info('Walmart scores stored in DynamoDB', {
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
          timestamp,
        });
      } catch (dbError) {
        // Continue with S3 upload even if DynamoDB fails...

        logger.error('Failed to store Walmart scores in DynamoDB', {
          error: dbError,
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
        });
      }
    }

    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../../dev/scores');

      // Write physical scores
      const physicalFilePath = path.join(
        scoresDir,
        'walmart-physical-scores.json',
      );
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(
        physicalFilePath,
        JSON.stringify({ scores: physicalScores, calculatedAt }, null, 2),
      );
      logger.info('Walmart physical scores written to file', {
        filePath: physicalFilePath,
      });

      // Write technology scores
      const technologyFilePath = path.join(
        scoresDir,
        'walmart-technology-scores.json',
      );
      fs.writeFileSync(
        technologyFilePath,
        JSON.stringify({ scores: technologyScores, calculatedAt }, null, 2),
      );
      logger.info('Walmart technology scores written to file', {
        filePath: technologyFilePath,
      });
    } else {
      // Upload physical scores to S3
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/walmart-physical-scores.json',
        body: JSON.stringify({ scores: physicalScores, calculatedAt }, null, 2),
        metadata: { calculatedAt, signal: 'WALMART_PHYSICAL' },
      });
      logger.info('Walmart physical scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/walmart-physical-scores.json',
      });

      // Upload technology scores to S3
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/walmart-technology-scores.json',
        body: JSON.stringify(
          { scores: technologyScores, calculatedAt },
          null,
          2,
        ),
        metadata: { calculatedAt, signal: 'WALMART_TECHNOLOGY' },
      });
      logger.info('Walmart technology scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/walmart-technology-scores.json',
      });
    }
    logger.info('SUCCESS: Walmart signal task completed successfully!');
  } catch (err) {
    logger.error('Walmart signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
