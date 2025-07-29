import { BlsService } from '../../services/bls/bls-service';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    logger.info('Starting BLS signal task...');

    const blsService = new BlsService();
    await blsService.processBlsData();

    // Get both physical and e-commerce scores
    const physicalScores = await blsService.getAllPhysicalScores();
    const ecommerceScores = await blsService.getAllEcommerceScores();

    const calculatedAt = new Date().toISOString();
    const timestamp = Math.floor(Date.now() / 1000);

    // Store both signals in DynamoDB for historical tracking...

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
          signalType: 'bls-physical',
          timestamp,
          calculatedAt,
          scores: physicalScores,
        });

        // Store e-commerce scores
        await signalScoresRepository.save({
          signalType: 'bls-ecommerce',
          timestamp,
          calculatedAt,
          scores: ecommerceScores,
        });

        logger.info('BLS signals stored in DynamoDB', {
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
          timestamp,
        });
      } catch (dbError) {
        // Continue with S3 upload even if DynamoDB fails...

        logger.error('Failed to store BLS signals in DynamoDB', {
          error: dbError,
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
        });
      }
    }

    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../../dev/scores');

      // Write physical scores
      const physicalFilePath = path.join(scoresDir, 'bls-physical-scores.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(
        physicalFilePath,
        JSON.stringify(physicalScores, null, 2),
      );

      // Write e-commerce scores
      const ecommerceFilePath = path.join(
        scoresDir,
        'bls-ecommerce-scores.json',
      );
      fs.writeFileSync(
        ecommerceFilePath,
        JSON.stringify(ecommerceScores, null, 2),
      );

      logger.info('BLS signals written to files', {
        physicalFilePath,
        ecommerceFilePath,
      });
    } else {
      // Upload physical scores to S3
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/bls-physical-scores.json',
        body: JSON.stringify({ scores: physicalScores, calculatedAt }, null, 2),
        metadata: { calculatedAt, signal: 'BLS_PHYSICAL' },
      });

      // Upload e-commerce scores to S3
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/signals/bls-ecommerce-scores.json',
        body: JSON.stringify(
          { scores: ecommerceScores, calculatedAt },
          null,
          2,
        ),
        metadata: { calculatedAt, signal: 'BLS_ECOMMERCE' },
      });

      logger.info('BLS signals uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        physicalKey: 'data/signals/bls-physical-scores.json',
        ecommerceKey: 'data/signals/bls-ecommerce-scores.json',
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
