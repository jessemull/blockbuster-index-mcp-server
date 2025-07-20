import { uploadToS3, logger } from '../../util';
import fs from 'fs';
import path from 'path';

const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

jest.mock('fs');
jest.mock('path');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  uploadToS3: jest.fn(),
}));
jest.mock('./get-census-scores', () => ({
  getCensusScores: jest.fn().mockResolvedValue({ CA: 1, NY: 2 }),
}));
jest.mock('../../config', () => ({
  get CONFIG() {
    return {
      IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
      S3_BUCKET_NAME: 'test-bucket',
    };
  },
}));

describe('Census signal entrypoint', () => {
  const resolve = path.resolve as jest.Mock;
  const join = path.join as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME;

    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/census-scores.json');

    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  it('writes Census scores to file in development', async () => {
    const { main } = await import('./entrypoint');
    await main();

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mocked/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/census-scores.json',
      expect.stringContaining('scores'),
    );
    expect(logger.info).toHaveBeenCalledWith('Starting Census signal task...');
    expect(logger.info).toHaveBeenCalledWith('Census scores written to file', {
      filePath: '/mocked/dev/scores/census-scores.json',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'SUCCESS: Census signal task completed successfully!',
    );
  });

  it('uploads Census scores to S3 in production', async () => {
    process.env.NODE_ENV = 'production';

    const { main } = await import('./entrypoint');
    await main();

    expect(uploadToS3).toHaveBeenCalledWith({
      bucket: 'test-bucket',
      key: 'data/signals/census-scores.json',
      body: expect.stringContaining('scores'),
      metadata: expect.objectContaining({
        calculatedAt: expect.any(String),
        signal: 'CENSUS',
      }),
    });
    expect(logger.info).toHaveBeenCalledWith('Starting Census signal task...');
    expect(logger.info).toHaveBeenCalledWith('Census scores uploaded to S3', {
      bucket: 'test-bucket',
      key: 'data/signals/census-scores.json',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'SUCCESS: Census signal task completed successfully!',
    );
  });

  it('stores scores in DynamoDB when SIGNAL_SCORES_DYNAMODB_TABLE_NAME is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME = 'mock-signal-scores-table';

    jest.doMock('../../repositories', () => ({
      DynamoDBSignalScoresRepository: class {
        save = jest.fn().mockResolvedValue(undefined);
      },
    }));

    const { main } = await import('./entrypoint');
    await main();

    expect(logger.info).toHaveBeenCalledWith(
      'Census scores stored in DynamoDB',
      {
        table: 'mock-signal-scores-table',
        timestamp: expect.any(Number),
      },
    );
    expect(uploadToS3).toHaveBeenCalled();
  });

  it('does not store in DynamoDB when SIGNAL_SCORES_DYNAMODB_TABLE_NAME is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME;

    const { main } = await import('./entrypoint');
    await main();

    expect(logger.info).not.toHaveBeenCalledWith(
      'Census scores stored in DynamoDB',
      expect.any(Object),
    );
    expect(uploadToS3).toHaveBeenCalled();
  });

  it('logs and exits on file system error in development', async () => {
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('File system error');
    });

    const { main } = await import('./entrypoint');
    await expect(main()).rejects.toThrow('process.exit called');

    expect(logger.error).toHaveBeenCalledWith(
      'Census signal task failed:',
      expect.any(Error),
    );
  });

  it('logs and exits on S3 upload error in production', async () => {
    process.env.NODE_ENV = 'production';
    (uploadToS3 as jest.Mock).mockRejectedValue(new Error('S3 upload error'));

    const { main } = await import('./entrypoint');
    await expect(main()).rejects.toThrow('process.exit called');

    expect(logger.error).toHaveBeenCalledWith(
      'Census signal task failed:',
      expect.any(Error),
    );
  });
});
