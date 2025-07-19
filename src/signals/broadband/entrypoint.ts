import { getBroadbandScores } from './get-broadband-scores';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

// DEBUG: Log environment variables IMMEDIATELY when module loads
logger.info(
  'ENV_DEBUG_MODULE_LOAD: Starting environment variable check at module load',
);
logger.info(
  `ENV_DEBUG_MODULE_LOAD: BROADBAND_S3_BUCKET = ${process.env.BROADBAND_S3_BUCKET || 'UNDEFINED'}`,
);
logger.info(
  `ENV_DEBUG_MODULE_LOAD: NODE_ENV = ${process.env.NODE_ENV || 'UNDEFINED'}`,
);
logger.info(
  `ENV_DEBUG_MODULE_LOAD: AWS_REGION = ${process.env.AWS_REGION || 'UNDEFINED'}`,
);
logger.info(
  `ENV_DEBUG_MODULE_LOAD: BROADBAND_DYNAMODB_TABLE_NAME = ${process.env.BROADBAND_DYNAMODB_TABLE_NAME || 'UNDEFINED'}`,
);
logger.info(
  `ENV_DEBUG_MODULE_LOAD: SIGNAL_SCORES_DYNAMODB_TABLE_NAME = ${process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME || 'UNDEFINED'}`,
);
logger.info(
  `ENV_DEBUG_MODULE_LOAD: npm_package_version = ${process.env.npm_package_version || 'UNDEFINED'}`,
);
logger.info(
  'ENV_DEBUG_MODULE_LOAD: Environment variable check completed at module load',
);

async function main() {
  try {
    logger.info('Starting Broadband signal task...');

    // DEBUG: Log environment variables at entrypoint
    logger.info('ENV_DEBUG_ENTRYPOINT: Starting environment variable check');
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: BROADBAND_S3_BUCKET = ${process.env.BROADBAND_S3_BUCKET || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: NODE_ENV = ${process.env.NODE_ENV || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: AWS_REGION = ${process.env.AWS_REGION || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: BROADBAND_DYNAMODB_TABLE_NAME = ${process.env.BROADBAND_DYNAMODB_TABLE_NAME || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: SIGNAL_SCORES_DYNAMODB_TABLE_NAME = ${process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: npm_package_version = ${process.env.npm_package_version || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: CONFIG.IS_DEVELOPMENT = ${CONFIG.IS_DEVELOPMENT}`,
    );
    logger.info(
      `ENV_DEBUG_ENTRYPOINT: CONFIG.S3_BUCKET_NAME = ${CONFIG.S3_BUCKET_NAME}`,
    );
    logger.info('ENV_DEBUG_ENTRYPOINT: Environment variable check completed');
    const scores = await getBroadbandScores();
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
          signalType: 'broadband',
          timestamp,
          calculatedAt,
          scores,
        });

        logger.info('Broadband scores stored in DynamoDB', {
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
          timestamp,
        });
      } catch (dbError) {
        // Continue with S3 upload even if DynamoDB fails...

        logger.error('Failed to store Broadband scores in DynamoDB', {
          error: dbError,
          table: process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
        });
      }
    }

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
    logger.info('SUCCESS: Broadband signal task completed successfully!');
  } catch (err) {
    logger.error('Broadband signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
