import fs from 'fs';
import path from 'path';
import { logger, uploadToS3 } from '../../util';
import { publishSignalArtifacts } from './publish-signal-artifacts';

jest.mock('fs');
jest.mock('path');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  uploadToS3: jest.fn(),
}));
jest.mock('../../config', () => ({
  get CONFIG() {
    return {
      IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'test-bucket',
      SIGNAL_SCORES_DYNAMODB_TABLE_NAME:
        process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
    };
  },
}));

describe('publishSignalArtifacts', () => {
  const resolve = path.resolve as jest.Mock;
  const join = path.join as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME;
    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockImplementation((...parts: string[]) => parts.join('/'));
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  it('writes wrapped local files in development by default', async () => {
    await publishSignalArtifacts([
      {
        signalType: 'amazon',
        scores: { CA: 1 },
        s3Key: 'data/signals/amazon-scores.json',
        localFileName: 'amazon-scores.json',
        metadataSignal: 'AMAZON',
      },
    ]);

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mocked/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/amazon-scores.json',
      expect.stringContaining('"scores"'),
    );
  });

  it('writes raw scores locally when wrapLocalBody is false', async () => {
    await publishSignalArtifacts(
      [
        {
          signalType: 'bls-physical',
          scores: { CA: 10 },
          s3Key: 'data/signals/bls-physical-scores.json',
          localFileName: 'bls-physical-scores.json',
          metadataSignal: 'BLS_PHYSICAL',
        },
      ],
      { wrapLocalBody: false },
    );

    const written = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    expect(JSON.parse(written)).toEqual({ CA: 10 });
  });

  it('uploads to S3 in production', async () => {
    process.env.NODE_ENV = 'production';

    await publishSignalArtifacts([
      {
        signalType: 'census',
        scores: { TX: 2 },
        s3Key: 'data/signals/census-scores.json',
        localFileName: 'census-scores.json',
        metadataSignal: 'CENSUS',
      },
    ]);

    expect(uploadToS3).toHaveBeenCalledWith({
      bucket: 'test-bucket',
      key: 'data/signals/census-scores.json',
      body: expect.stringContaining('scores'),
      metadata: expect.objectContaining({ signal: 'CENSUS' }),
    });
  });

  it('continues when DynamoDB save fails', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME = 'scores-table';

    jest.doMock('../../repositories', () => ({
      DynamoDBSignalScoresRepository: class {
        save = jest.fn().mockRejectedValue(new Error('ddb down'));
      },
    }));

    await publishSignalArtifacts([
      {
        signalType: 'walmart',
        scores: { NY: 3 },
        s3Key: 'data/signals/walmart-scores.json',
        localFileName: 'walmart-scores.json',
        metadataSignal: 'WALMART',
      },
    ]);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to store signal scores in DynamoDB',
      expect.objectContaining({ table: 'scores-table' }),
    );
    expect(uploadToS3).toHaveBeenCalled();
  });
});
