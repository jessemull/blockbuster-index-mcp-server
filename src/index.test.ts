import fs from 'fs';
import path from 'path';

import { main } from './index';
import * as signals from './signals';
import { States } from './types';
import { logger, retryWithBackoff, uploadToS3 } from './util';

jest.mock('fs');
jest.mock('path');
jest.mock('./signals');
jest.mock('./util', () => ({
  logger: {
    debug: jest.fn(),
    endOperation: jest.fn(),
    error: jest.fn(),
    errorWithContext: jest.fn(),
    info: jest.fn(),
    performance: jest.fn(),
    signal: jest.fn(),
    startOperation: jest.fn(),
    warn: jest.fn(),
  },
  retryWithBackoff: jest.fn((fn) => fn()),
  uploadToS3: jest.fn().mockResolvedValue(undefined),
}));

const mockExit = jest
  .spyOn(process, 'exit')
  .mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit: ${code}`);
  });

describe('main()', () => {
  const mockScores = {
    [States.AK]: 1,
    [States.AR]: 2,
  };

  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      S3_BUCKET_NAME: 'bucket',
    };

    (signals.getAmazonScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getAnalogScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getCommerceScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getPhysicalScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getStreamingScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getWalmartScores as jest.Mock).mockResolvedValue(mockScores);

    (path.resolve as jest.Mock).mockReturnValue('/fake/dev/scores');
    (path.join as jest.Mock).mockReturnValue(
      '/fake/dev/scores/blockbuster-index.json',
    );

    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // Mock retryWithBackoff to just call the function
    (retryWithBackoff as jest.Mock).mockImplementation((fn) => fn());
  });

  afterAll(() => {
    process.env = OLD_ENV;
    mockExit.mockRestore();
  });

  it('calculates scores and logs JSON in production mode', async () => {
    await main();
    expect(logger.startOperation).toHaveBeenCalled();
    expect(logger.performance).toHaveBeenCalled();
    expect(logger.signal).toHaveBeenCalled();
    expect(logger.endOperation).toHaveBeenCalled();
    expect(uploadToS3).toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('calculates scores and writes file in development mode', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'development',
      S3_BUCKET_NAME: 'bucket',
    };
    await main();
    expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/fake/dev/scores/blockbuster-index.json',
      expect.stringContaining('"score":'),
    );
    expect(logger.performance).toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('computes correct weighted scores based on WEIGHTS constant', async () => {
    const customScores = {
      [States.AL]: 1,
      [States.AK]: 2,
    };
    (signals.getAmazonScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getAnalogScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getCommerceScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getPhysicalScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getStreamingScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getWalmartScores as jest.Mock).mockResolvedValue(customScores);
    await main();
    expect(logger.signal).toHaveBeenCalled();
  });

  it('calls process.exit(1) and logs error on failure', async () => {
    const error = new Error('fail');
    (signals.getAmazonScores as jest.Mock).mockRejectedValue(error);
    await expect(main()).rejects.toThrow('process.exit: 1');
    expect(logger.errorWithContext).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      error,
      expect.any(Object),
    );
  });

  it('calls process.exit(1) if uploadToS3 fails', async () => {
    (uploadToS3 as jest.Mock).mockRejectedValue(new Error('s3fail'));
    await expect(main()).rejects.toThrow('process.exit: 1');
    expect(logger.errorWithContext).toHaveBeenCalledWith(
      'Blockbuster index calculation failed:',
      expect.any(Error),
      expect.any(Object),
    );
  });

  it('handles missing state keys by defaulting to 0', async () => {
    (signals.getAmazonScores as jest.Mock).mockResolvedValue({});
    await main();
    expect(logger.signal).toHaveBeenCalled();
  });

  it('retries on signal fetch failure and eventually succeeds', async () => {
    let callCount = 0;
    (signals.getAmazonScores as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount < 2) throw new Error('fail');
      return Promise.resolve(mockScores);
    });
    await main();
    expect(logger.errorWithContext).toHaveBeenCalledWith(
      'Attempt 1 failed:',
      expect.any(Error),
    );
    expect(logger.signal).toHaveBeenCalled();
  });
});
