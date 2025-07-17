import { uploadToS3 } from '../../util';
import fs from 'fs';
import path from 'path';
import * as getAmazonScoresModule from './get-amazon-scores';

jest.mock('fs');
jest.mock('path');
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  uploadToS3: jest.fn(),
}));

describe('Amazon signal entrypoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  it('writes Amazon scores to file in development', async () => {
    jest
      .spyOn(getAmazonScoresModule, 'getAmazonScores')
      .mockResolvedValue({ CA: 1, NY: 2 });
    const resolve = path.resolve as jest.Mock;
    const join = path.join as jest.Mock;
    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/amazon-scores.json');
    await import('./entrypoint');
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('uploads Amazon scores to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    jest
      .spyOn(getAmazonScoresModule, 'getAmazonScores')
      .mockResolvedValue({ CA: 1, NY: 2 });
    await import('./entrypoint');
    expect(uploadToS3).toHaveBeenCalled();
  });
});
