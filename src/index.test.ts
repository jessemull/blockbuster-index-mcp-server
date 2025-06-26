import * as signals from './signals';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';
import { logger, uploadToS3 } from './util';
import { main } from './index';

jest.mock('fs');

jest.mock('path');

jest.mock('./config', () => ({
  CONFIG: {
    IS_DEVELOPMENT: true,
    VERSION: '1.0.0',
    NODE_ENV: 'development',
    S3_BUCKET_NAME: 'fake-bucket',
  },
  validateConfig: jest.fn(),
}));

jest.mock('./constants', () => ({
  WEIGHTS: {
    AMAZON: 1,
    ANALOG: 1,
    BROADBAND: 1,
    ECOMMERCE: 1,
    PHYSICAL: 1,
    STREAMING: 1,
    WALMART: 1,
  },
}));

jest.mock('./signals');

jest.mock('./util', () => ({
  logger: {
    startOperation: jest.fn(),
    endOperation: jest.fn(),
    performance: jest.fn(),
    signal: jest.fn(),
    errorWithContext: jest.fn(),
  },
  retryWithBackoff: jest.fn((fn) => fn()),
  uploadToS3: jest.fn(),
}));

describe('main', () => {
  const mockScores = {
    CA: 1,
    NY: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    Object.assign(signals, {
      getAmazonScores: jest.fn().mockResolvedValue(mockScores),
      getAnalogScores: jest.fn().mockResolvedValue(mockScores),
      getBroadbandScores: jest.fn().mockResolvedValue(mockScores),
      getCommerceScores: jest.fn().mockResolvedValue(mockScores),
      getPhysicalScores: jest.fn().mockResolvedValue(mockScores),
      getStreamingScores: jest.fn().mockResolvedValue(mockScores),
      getWalmartScores: jest.fn().mockResolvedValue(mockScores),
    });

    Object.assign(CONFIG, {
      IS_DEVELOPMENT: true,
      VERSION: '1.0.0',
      NODE_ENV: 'development',
      S3_BUCKET_NAME: 'fake-bucket',
    });
  });

  it('writes scores to file in development mode', async () => {
    const resolve = path.resolve as jest.Mock;
    const join = path.join as jest.Mock;

    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/blockbuster-index.json');

    await main();

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mocked/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/blockbuster-index.json',
      expect.stringContaining('"version": "1.0.0"'),
    );

    expect(logger.performance).toHaveBeenCalledWith(
      'file_written',
      expect.any(Number),
      expect.objectContaining({ filePath: expect.any(String) }),
    );
  });

  it('uploads to S3 in production mode', async () => {
    CONFIG.IS_DEVELOPMENT = false;

    await main();

    expect(uploadToS3).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'fake-bucket',
        key: 'data/data.json',
        metadata: expect.objectContaining({
          version: '1.0.0',
        }),
      }),
    );

    expect(logger.performance).toHaveBeenCalledWith(
      's3_uploaded',
      expect.any(Number),
      expect.objectContaining({ bucket: 'fake-bucket' }),
    );
  });

  it('validates config when not in development mode', async () => {
    CONFIG.IS_DEVELOPMENT = false;
    const { validateConfig } = await import('./config');

    await main();

    expect(validateConfig).toHaveBeenCalled();
  });

  it('logs and exits on error', async () => {
    const error = new Error('mock failure');
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    (signals.getAmazonScores as jest.Mock).mockRejectedValueOnce(error);

    await expect(main()).rejects.toThrow('process.exit');
    expect(logger.errorWithContext).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      error,
      expect.objectContaining({ environment: 'development' }),
    );

    mockExit.mockRestore();
  });

  it('logs and exits on non-Error throw', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    (signals.getAmazonScores as jest.Mock).mockRejectedValueOnce(
      'string error',
    );

    await expect(main()).rejects.toThrow('process.exit');
    expect(logger.errorWithContext).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      expect.any(Error),
      expect.objectContaining({ environment: 'development' }),
    );

    mockExit.mockRestore();
  });
});
