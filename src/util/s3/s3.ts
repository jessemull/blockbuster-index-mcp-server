import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { CONFIG } from '../../config';
import { logger } from '../logger';

export const s3Client = new S3Client({
  maxAttempts: 3,
  region: CONFIG.AWS_REGION,
});

export interface S3UploadOptions {
  body: string | Buffer;
  bucket: string;
  cacheControl?: string;
  contentType?: string;
  key: string;
  metadata?: Record<string, string>;
}

export const uploadToS3 = async (options: S3UploadOptions): Promise<void> => {
  try {
    const command = new PutObjectCommand({
      Body: options.body,
      Bucket: options.bucket,
      CacheControl: options.cacheControl || CONFIG.CACHE_CONTROL,
      ContentType: options.contentType || 'application/json',
      Key: options.key,
      Metadata: options.metadata,
    });

    await s3Client.send(command);

    logger.performance('s3_upload_success', 0, {
      bucket: options.bucket,
      key: options.key,
    });
  } catch (error) {
    const s3Error = error as S3ServiceException;
    logger.errorWithContext('S3 upload failed:', s3Error, {
      bucket: options.bucket,
      code: s3Error.name,
      key: options.key,
    });
    throw s3Error;
  }
};

export const downloadFromS3 = async (
  bucket: string,
  key: string,
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();

    if (!body) {
      throw new Error('Empty response body from S3');
    }

    logger.performance('s3_download_success', 0, {
      bucket,
      key,
    });

    return body;
  } catch (error) {
    const s3Error = error as S3ServiceException;
    logger.errorWithContext('S3 download failed:', s3Error, {
      bucket,
      code: s3Error.name,
      key,
    });
    throw s3Error;
  }
};
