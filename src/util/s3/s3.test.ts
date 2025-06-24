import { PutObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { s3Client, uploadToS3, downloadFromS3 } from './s3';
import { logger } from '../logger';
import { __ServiceExceptionOptions } from '@aws-sdk/client-s3/dist-types/models/S3ServiceException';

jest.mock('@aws-sdk/client-s3', () => {
  const original = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...original,
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

jest.mock('../../config', () => ({
  CONFIG: {
    AWS_REGION: 'us-west-2',
    CACHE_CONTROL: 'no-cache',
  },
}));

jest.mock('../logger', () => ({
  logger: {
    performance: jest.fn(),
    errorWithContext: jest.fn(),
  },
}));

describe('S3 Utils', () => {
  const mockSend = s3Client.send as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadToS3', () => {
    it('uploads successfully with full options', async () => {
      mockSend.mockResolvedValueOnce({});

      await uploadToS3({
        body: 'file contents',
        bucket: 'my-bucket',
        cacheControl: 'max-age=3600',
        contentType: 'text/plain',
        key: 'my-key',
        metadata: { author: 'me' },
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(logger.performance).toHaveBeenCalledWith(
        's3_upload_success',
        0,
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'my-key',
        }),
      );
    });

    it('uploads successfully with default contentType and cacheControl', async () => {
      mockSend.mockResolvedValueOnce({});

      await uploadToS3({
        body: Buffer.from('buffer content'),
        bucket: 'default-bucket',
        key: 'default-key',
      });

      const sentCommand = mockSend.mock.calls[0][0].input;
      expect(sentCommand.ContentType).toBe('application/json');
      expect(sentCommand.CacheControl).toBe('no-cache');
    });

    it('logs and throws on upload error', async () => {
      const error = new S3ServiceException({
        name: 'AccessDenied',
        message: 'Access Denied',
        $metadata: {},
      } as __ServiceExceptionOptions);
      mockSend.mockRejectedValueOnce(error);

      await expect(
        uploadToS3({
          body: 'fail',
          bucket: 'b',
          key: 'k',
        }),
      ).rejects.toThrow('Access Denied');

      expect(logger.errorWithContext).toHaveBeenCalledWith(
        'S3 upload failed:',
        error,
        expect.objectContaining({
          bucket: 'b',
          key: 'k',
          code: 'AccessDenied',
        }),
      );
    });
  });

  describe('downloadFromS3', () => {
    it('downloads and returns content successfully', async () => {
      const mockBody = {
        transformToString: jest.fn().mockResolvedValue('file data'),
      };

      mockSend.mockResolvedValueOnce({ Body: mockBody });

      const result = await downloadFromS3('my-bucket', 'my-key');

      expect(result).toBe('file data');
      expect(mockBody.transformToString).toHaveBeenCalled();
      expect(logger.performance).toHaveBeenCalledWith(
        's3_download_success',
        0,
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'my-key',
        }),
      );
    });

    it('throws an error when response body is empty', async () => {
      mockSend.mockResolvedValueOnce({ Body: undefined });

      await expect(downloadFromS3('b', 'k')).rejects.toThrow(
        'Empty response body from S3',
      );
    });

    it('logs and throws on download error', async () => {
      const error = new S3ServiceException({
        name: 'NoSuchKey',
        message: 'The specified key does not exist',
        $metadata: {},
      } as __ServiceExceptionOptions);

      mockSend.mockRejectedValueOnce(error);

      await expect(downloadFromS3('bucket', 'missing-key')).rejects.toThrow(
        'The specified key does not exist',
      );

      expect(logger.errorWithContext).toHaveBeenCalledWith(
        'S3 download failed:',
        error,
        expect.objectContaining({
          bucket: 'bucket',
          key: 'missing-key',
          code: 'NoSuchKey',
        }),
      );
    });
  });
});
