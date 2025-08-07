import { CONFIG } from '../../config';
import { SIGNALS } from '../../constants/signals';
import { Signal, BlockbusterIndexRecord } from '../../types';
import { logger, uploadToS3, downloadFromS3 } from '../../util';
import { BlsService } from '../../services/bls/bls-service';
import fs from 'fs';
import path from 'path';
import { calculateBlockbusterIndex } from './calculate';

async function getSignalScores(
  signalName: string,
): Promise<Record<string, number>> {
  // For BLS signals, use the service methods to get corrected scores
  if (signalName === 'bls-physical' || signalName === 'bls-ecommerce') {
    const blsService = new BlsService();
    if (signalName === 'bls-physical') {
      return await blsService.getAllPhysicalScores();
    } else {
      return await blsService.getAllEcommerceScores();
    }
  }

  // For other signals, use the file-based approach
  if (CONFIG.IS_DEVELOPMENT) {
    const scoresDir = path.resolve(__dirname, '../../dev/scores');
    const filePath = path.join(scoresDir, `${signalName}-scores.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing local file for ${signalName}: ${filePath}`);
    }
    const { scores } = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return scores;
  } else {
    if (!CONFIG.S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME is required for production mode');
    }
    const key = `data/signals/${signalName}-scores.json`;
    const data = await downloadFromS3(CONFIG.S3_BUCKET_NAME, key);
    const { scores } = JSON.parse(data);
    return scores;
  }
}

async function main() {
  try {
    logger.info('Starting blockbuster index combiner...');
    const signalResults: Record<Signal, Record<string, number>> = {} as Record<
      Signal,
      Record<string, number>
    >;
    for (const { name, signal } of SIGNALS) {
      signalResults[signal] = await getSignalScores(name);
    }

    const response = calculateBlockbusterIndex(signalResults, CONFIG.VERSION);

    // Store blockbuster index in DynamoDB for historical tracking...

    if (
      !CONFIG.IS_DEVELOPMENT &&
      process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME
    ) {
      try {
        const { DynamoDBBlockbusterIndexRepository } = await import(
          '../../repositories'
        );
        const blockbusterIndexRepository =
          new DynamoDBBlockbusterIndexRepository(
            process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME,
          );

        const blockbusterRecord: BlockbusterIndexRecord = {
          timestamp: Math.floor(Date.now() / 1000),
          calculatedAt: response.metadata.calculatedAt,
          version: CONFIG.VERSION,
          totalStates: Object.keys(response.states).length,
          states: response.states,
          signalStatus: {
            total: SIGNALS.length,
            successful: SIGNALS.length,
            failed: 0,
          },
        };

        await blockbusterIndexRepository.save(blockbusterRecord);

        logger.info('Blockbuster index stored in DynamoDB', {
          table: process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME,
          timestamp: blockbusterRecord.timestamp,
        });
      } catch (dbError) {
        // Continue with S3 upload even if DynamoDB fails...

        logger.error('Failed to store blockbuster index in DynamoDB', {
          error: dbError,
          table: process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME,
        });
      }
    }

    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../../dev/scores');
      const filePath = path.join(scoresDir, 'blockbuster-index.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
      logger.info('Blockbuster index written to file', { filePath });
    } else {
      if (!CONFIG.S3_BUCKET_NAME) {
        throw new Error('S3_BUCKET_NAME is required for production mode');
      }
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME,
        key: 'data/data.json',
        body: JSON.stringify(response, null, 2),
        metadata: {
          version: CONFIG.VERSION,
          calculatedAt: response.metadata.calculatedAt,
        },
      });
      logger.info('Blockbuster index uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME,
        key: 'data/data.json',
      });
    }
    logger.info('SUCCESS: Blockbuster index combiner completed successfully!');
  } catch (err) {
    logger.error('Blockbuster index combiner failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
