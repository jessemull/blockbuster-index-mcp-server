import { uploadToS3 } from '../util';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  uploadToS3: jest.fn(),
  downloadFromS3: jest
    .fn()
    .mockResolvedValue(JSON.stringify({ scores: { CA: 1, NY: 2 } })),
}));

describe('Blockbuster index combiner entrypoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  it('writes blockbuster index to file in development', async () => {
    const resolve = path.resolve as jest.Mock;
    const join = path.join as jest.Mock;
    resolve.mockReturnValue('/mocked/dev/scores');
    join.mockReturnValue('/mocked/dev/scores/blockbuster-index.json');
    await import('./entrypoint');
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('uploads blockbuster index to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    await import('./entrypoint');
    expect(uploadToS3).toHaveBeenCalled();
  });
});
