import { uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';

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
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  it('writes Census scores to file in development', async () => {
    const resolve = path.resolve as jest.Mock;
    const join = path.join as jest.Mock;
    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/census-scores.json');
    const { main } = await import('./entrypoint');
    await main();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('uploads Census scores to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    const { main } = await import('./entrypoint');
    await main();
    expect(uploadToS3).toHaveBeenCalled();
  });
});
