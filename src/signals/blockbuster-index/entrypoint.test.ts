import { uploadToS3, downloadFromS3, logger } from '../../util';
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
    success: jest.fn(),
  },
  uploadToS3: jest.fn(),
  downloadFromS3: jest.fn(),
}));
jest.mock('../../config', () => ({
  get CONFIG() {
    return {
      IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
      S3_BUCKET_NAME: 'test-bucket',
      VERSION: 'test-version',
    };
  },
}));
jest.mock('../../constants', () => ({
  WEIGHTS: {
    amazon: 0.5,
    census: 0.3,
    broadband: 0.2,
  },
}));
jest.mock('../../types', () => ({
  States: { CA: 'CA', OR: 'OR' },
  Signal: {
    AMAZON: 'amazon',
    CENSUS: 'census',
    BROADBAND: 'broadband',
  },
}));

describe('blockbuster index combiner entrypoint', () => {
  const resolve = path.resolve as jest.Mock;
  const join = path.join as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME;

    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockImplementation((...paths) => paths.join('/'));

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath) => {
      if (filePath.includes('amazon-scores.json')) {
        return JSON.stringify({ scores: { CA: 1, OR: 0.8 } });
      }
      if (filePath.includes('census-scores.json')) {
        return JSON.stringify({ scores: { CA: 0.5, OR: 0.6 } });
      }
      if (filePath.includes('broadband-scores.json')) {
        return JSON.stringify({ scores: { CA: 0.2, OR: 0.4 } });
      }
      return '{}';
    });
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
      '/mocked/dev/scores/blockbuster-index.json',
      expect.stringContaining('states'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Blockbuster index written to file',
      expect.any(Object),
    );
    expect(logger.success).toHaveBeenCalledWith(
      'SUCCESS: Blockbuster index combiner completed successfully!',
    );
  });

  it('uploads to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    (downloadFromS3 as jest.Mock).mockResolvedValue(
      JSON.stringify({ scores: { CA: 1 } }),
    );

    const { main } = await import('./entrypoint');
    await main();

    expect(uploadToS3).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'test-bucket',
        key: 'data/data.json',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Blockbuster index uploaded to S3',
      expect.any(Object),
    );
    expect(logger.success).toHaveBeenCalledWith(
      'SUCCESS: Blockbuster index combiner completed successfully!',
    );
  });

  it('logs and exits on local file error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const { main } = await import('./entrypoint');
    await expect(main()).rejects.toThrow('process.exit called');

    expect(logger.error).toHaveBeenCalledWith(
      'Blockbuster index combiner failed:',
      expect.any(Error),
    );
  });

  it('continues on DynamoDB failure and still uploads to S3', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME = 'mock-table';
    (downloadFromS3 as jest.Mock).mockResolvedValue(
      JSON.stringify({ scores: { CA: 1 } }),
    );

    jest.doMock('../../repositories', () => ({
      DynamoDBBlockbusterIndexRepository: class {
        save = jest.fn().mockRejectedValue(new Error('ddb error'));
      },
    }));

    const { main } = await import('./entrypoint');
    await main();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to store blockbuster index in DynamoDB',
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(uploadToS3).toHaveBeenCalled();
    expect(logger.success).toHaveBeenCalledWith(
      'SUCCESS: Blockbuster index combiner completed successfully!',
    );
  });
});
