jest.mock('puppeteer', () => ({
  default: {
    launch: jest.fn(),
  },
  launch: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

import * as signals from './signals';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';
import { logger, uploadToS3 } from './util';
import { main } from './main';

jest.mock('fs');

jest.mock('path');

jest.mock('./config', () => ({
  CONFIG: {
    IS_DEVELOPMENT: true,
    NODE_ENV: 'development',
    S3_BUCKET_NAME: 'fake-bucket',
    VERSION: '1.0.0',
  },
  validateConfig: jest.fn(),
}));

jest.mock('./constants', () => ({
  WEIGHTS: {
    AMAZON: 0.33,
    CENSUS: 0.33,
    BROADBAND: 0.34,
  },
}));

jest.mock('./signals');

jest.mock('./util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
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
      getCensusScores: jest.fn().mockResolvedValue(mockScores),
      getBroadbandScores: jest.fn().mockResolvedValue(mockScores),
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

    expect(logger.info).toHaveBeenCalledWith(
      'File written',
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

    expect(logger.info).toHaveBeenCalledWith(
      'S3 uploaded',
      expect.objectContaining({
        bucket: 'fake-bucket',
        key: 'data/data.json',
      }),
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
    (signals.getCensusScores as jest.Mock).mockRejectedValueOnce(error);
    (signals.getBroadbandScores as jest.Mock).mockRejectedValueOnce(error);

    await expect(main()).rejects.toThrow('process.exit');
    expect(logger.error).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      expect.objectContaining({
        error: 'All signals failed - cannot generate index',
        stack: expect.stringContaining(
          'All signals failed - cannot generate index',
        ),
        duration: expect.any(Number),
        environment: 'development',
      }),
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
    (signals.getCensusScores as jest.Mock).mockRejectedValueOnce(
      'string error',
    );
    (signals.getBroadbandScores as jest.Mock).mockRejectedValueOnce(
      'string error',
    );

    await expect(main()).rejects.toThrow('process.exit');
    expect(logger.error).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      expect.objectContaining({
        error: 'All signals failed - cannot generate index',
        stack: expect.stringContaining(
          'All signals failed - cannot generate index',
        ),
        duration: expect.any(Number),
        environment: 'development',
      }),
    );

    mockExit.mockRestore();
  });

  it('continues processing when one signal fails', async () => {
    const resolve = path.resolve as jest.Mock;
    const join = path.join as jest.Mock;

    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/blockbuster-index.json');

    (signals.getAmazonScores as jest.Mock).mockRejectedValueOnce(
      new Error('Amazon failed'),
    );
    (signals.getCensusScores as jest.Mock).mockResolvedValueOnce(mockScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValueOnce(mockScores);

    await main();

    expect(logger.error).toHaveBeenCalledWith(
      'Amazon signal failed:',
      expect.any(Error),
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/blockbuster-index.json',
      expect.stringContaining('"signalStatus"'),
    );

    expect(logger.info).toHaveBeenCalledWith(
      'Signals fetched',
      expect.objectContaining({
        totalSignals: 3,
        successfulSignals: 2,
        failedSignals: 1,
      }),
    );
  });

  it('fails when all signals fail', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    (signals.getAmazonScores as jest.Mock).mockRejectedValueOnce(
      new Error('Amazon failed'),
    );
    (signals.getCensusScores as jest.Mock).mockRejectedValueOnce(
      new Error('Census failed'),
    );
    (signals.getBroadbandScores as jest.Mock).mockRejectedValueOnce(
      new Error('Broadband failed'),
    );

    await expect(main()).rejects.toThrow('process.exit');

    expect(logger.error).toHaveBeenCalledWith(
      'Amazon signal failed:',
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Census signal failed:',
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Broadband signal failed:',
      expect.any(Error),
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      expect.objectContaining({
        error: 'All signals failed - cannot generate index',
        duration: expect.any(Number),
        environment: 'development',
      }),
    );

    mockExit.mockRestore();
  });
});
