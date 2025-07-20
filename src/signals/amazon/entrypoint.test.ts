import { uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

// Mock process.exit to prevent Jest from crashing
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
}));
jest.mock('./get-amazon-scores', () => ({
  getAmazonScores: jest.fn().mockResolvedValue({ CA: 1, NY: 2 }),
}));
jest.mock('../../config', () => ({
  get CONFIG() {
    return {
      IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
      S3_BUCKET_NAME: 'test-bucket',
    };
  },
}));

describe('Amazon signal entrypoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  it('writes Amazon scores to file in development', async () => {
    const resolve = path.resolve as jest.Mock;
    const join = path.join as jest.Mock;
    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/amazon-scores.json');
    const { main } = await import('./entrypoint');
    await main();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('uploads Amazon scores to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    const { main } = await import('./entrypoint');
    await main();
    expect(uploadToS3).toHaveBeenCalled();
  });
});
