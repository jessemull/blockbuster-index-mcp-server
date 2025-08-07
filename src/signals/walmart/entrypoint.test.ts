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
jest.mock('../../config', () => ({
  get CONFIG() {
    return {
      IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
      S3_BUCKET_NAME: 'test-bucket',
    };
  },
}));
jest.mock('./get-walmart-scores', () => ({
  getWalmartScores: jest.fn().mockResolvedValue({
    scores: { CA: 85.5, TX: 45.2, NY: 78.9 },
  }),
}));

describe('Walmart signal entrypoint', () => {
  const resolve = path.resolve as jest.Mock;
  const join = path.join as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME;

    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockImplementation((...paths) => paths.join('/'));

    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  it('writes output to file in development', async () => {
    const { main } = await import('./entrypoint');
    await main();

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mocked/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/walmart-scores.json',
      expect.stringContaining('"scores"'),
    );
    expect(logger.info).toHaveBeenCalledWith('Starting Walmart signal task...');
    expect(logger.info).toHaveBeenCalledWith('Walmart scores written to file', {
      filePath: '/mocked/dev/scores/walmart-scores.json',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'SUCCESS: Walmart signal task completed successfully!',
    );
  });

  it('uploads to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    (uploadToS3 as jest.Mock).mockResolvedValue(undefined);

    const { main } = await import('./entrypoint');
    await main();

    expect(uploadToS3).toHaveBeenCalledWith({
      bucket: 'test-bucket',
      key: 'data/signals/walmart-scores.json',
      body: expect.stringContaining('"scores"'),
      metadata: { calculatedAt: expect.any(String), signal: 'WALMART' },
    });
    expect(logger.info).toHaveBeenCalledWith('Walmart scores uploaded to S3', {
      bucket: 'test-bucket',
      key: 'data/signals/walmart-scores.json',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'SUCCESS: Walmart signal task completed successfully!',
    );
  });

  it('stores scores in DynamoDB in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME = 'mock-table';
    (uploadToS3 as jest.Mock).mockResolvedValue(undefined);

    jest.doMock('../../repositories', () => ({
      DynamoDBSignalScoresRepository: class {
        save = jest.fn().mockResolvedValue(undefined);
      },
    }));

    const { main } = await import('./entrypoint');
    await main();

    expect(logger.info).toHaveBeenCalledWith(
      'Walmart scores stored in DynamoDB',
      {
        table: 'mock-table',
        timestamp: expect.any(Number),
      },
    );
  });

  it('logs and exits on S3 upload error', async () => {
    process.env.NODE_ENV = 'production';
    (uploadToS3 as jest.Mock).mockRejectedValue(new Error('S3 error'));

    const { main } = await import('./entrypoint');
    await expect(main()).rejects.toThrow('process.exit called');

    expect(logger.error).toHaveBeenCalledWith(
      'Walmart signal task failed:',
      expect.any(Error),
    );
  });

  it('logs and exits on file write error', async () => {
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('File system error');
    });

    const { main } = await import('./entrypoint');
    await expect(main()).rejects.toThrow('process.exit called');

    expect(logger.error).toHaveBeenCalledWith(
      'Walmart signal task failed:',
      expect.any(Error),
    );
  });
});
