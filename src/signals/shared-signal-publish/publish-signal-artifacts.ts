import fs from 'fs';
import path from 'path';
import { CONFIG } from '../../config';
import { logger, uploadToS3 } from '../../util';

export interface SignalArtifact {
  localFileName: string;
  metadataSignal: string;
  s3Key: string;
  scores: Record<string, number>;
  signalType: string;
}

export interface PublishSignalArtifactsOptions {
  /**
   * When true (default), local files are `{ scores, calculatedAt }`.
   * When false, local files are the raw scores object (BLS historical shape).
   */
  wrapLocalBody?: boolean;
}

/**
 * Best-effort DynamoDB signal-scores history, then publish each artifact to
 * local `dev/scores/` (development) or S3 (production).
 */
export async function publishSignalArtifacts(
  artifacts: SignalArtifact[],
  options: PublishSignalArtifactsOptions = {},
): Promise<{ calculatedAt: string; timestamp: number }> {
  const wrapLocalBody = options.wrapLocalBody !== false;
  const calculatedAt = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000);

  if (!CONFIG.IS_DEVELOPMENT && CONFIG.SIGNAL_SCORES_DYNAMODB_TABLE_NAME) {
    try {
      const { DynamoDBSignalScoresRepository } =
        await import('../../repositories');
      const signalScoresRepository = new DynamoDBSignalScoresRepository(
        CONFIG.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
      );

      for (const artifact of artifacts) {
        await signalScoresRepository.save({
          signalType: artifact.signalType,
          timestamp,
          calculatedAt,
          scores: artifact.scores,
        });
      }

      logger.info('Signal scores stored in DynamoDB', {
        table: CONFIG.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
        timestamp,
        signalTypes: artifacts.map((a) => a.signalType),
      });
    } catch (dbError) {
      // Continue with S3/local publish even if DynamoDB fails...

      logger.error('Failed to store signal scores in DynamoDB', {
        error: dbError,
        table: CONFIG.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
      });
    }
  }

  if (CONFIG.IS_DEVELOPMENT) {
    const scoresDir = path.resolve(__dirname, '../../../dev/scores');
    fs.mkdirSync(scoresDir, { recursive: true });

    for (const artifact of artifacts) {
      const filePath = path.join(scoresDir, artifact.localFileName);
      const body = wrapLocalBody
        ? { scores: artifact.scores, calculatedAt }
        : artifact.scores;
      fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
      logger.info('Signal scores written to file', {
        filePath,
        signalType: artifact.signalType,
      });
    }
  } else {
    if (!CONFIG.S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME is required for production mode');
    }

    for (const artifact of artifacts) {
      await uploadToS3({
        bucket: CONFIG.S3_BUCKET_NAME,
        key: artifact.s3Key,
        body: JSON.stringify(
          { scores: artifact.scores, calculatedAt },
          null,
          2,
        ),
        metadata: { calculatedAt, signal: artifact.metadataSignal },
      });
      logger.info('Signal scores uploaded to S3', {
        bucket: CONFIG.S3_BUCKET_NAME,
        key: artifact.s3Key,
        signalType: artifact.signalType,
      });
    }
  }

  return { calculatedAt, timestamp };
}
