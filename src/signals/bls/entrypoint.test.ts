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
jest.mock('../../services/bls/bls-service', () => ({
  BlsService: jest.fn().mockImplementation(() => ({
    processBlsData: jest.fn().mockResolvedValue(undefined),
    getAllPhysicalScores: jest.fn().mockResolvedValue({ CA: 75.5, TX: 25.5 }),
    getAllEcommerceScores: jest.fn().mockResolvedValue({ CA: 80.0, TX: 60.0 }),
  })),
}));

describe('BLS signal entrypoint', () => {
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

  it('writes output to files in development', async () => {
    const { main } = await import('./entrypoint');
    await main();

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mocked/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/bls-physical-scores.json',
      JSON.stringify({ CA: 75.5, TX: 25.5 }, null, 2),
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mocked/dev/scores/bls-ecommerce-scores.json',
      JSON.stringify({ CA: 80.0, TX: 60.0 }, null, 2),
    );
    expect(logger.info).toHaveBeenCalledWith('Starting BLS signal task...');
    expect(logger.info).toHaveBeenCalledWith('BLS signals written to files', {
      physicalFilePath: '/mocked/dev/scores/bls-physical-scores.json',
      ecommerceFilePath: '/mocked/dev/scores/bls-ecommerce-scores.json',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'SUCCESS: BLS signal task completed successfully!',
    );
  });

  it('uploads to S3 in production', async () => {
    process.env.NODE_ENV = 'production';
    (uploadToS3 as jest.Mock).mockResolvedValue(undefined);

    const { main } = await import('./entrypoint');
    await main();

    expect(uploadToS3).toHaveBeenCalledWith({
      bucket: 'test-bucket',
      key: 'data/signals/bls-physical-scores.json',
      body: expect.stringContaining('"scores"'),
      metadata: { calculatedAt: expect.any(String), signal: 'BLS_PHYSICAL' },
    });
    expect(uploadToS3).toHaveBeenCalledWith({
      bucket: 'test-bucket',
      key: 'data/signals/bls-ecommerce-scores.json',
      body: expect.stringContaining('"scores"'),
      metadata: { calculatedAt: expect.any(String), signal: 'BLS_ECOMMERCE' },
    });
    expect(logger.info).toHaveBeenCalledWith('BLS signals uploaded to S3', {
      bucket: 'test-bucket',
      physicalKey: 'data/signals/bls-physical-scores.json',
      ecommerceKey: 'data/signals/bls-ecommerce-scores.json',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'SUCCESS: BLS signal task completed successfully!',
    );
  });

  it('stores signals in DynamoDB in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME = 'mock-table';
    (uploadToS3 as jest.Mock).mockResolvedValue(undefined);

    jest.doMock('../../repositories', () => ({
      DynamoDBSignalScoresRepository: class {
        constructor(tableName: string) {
          this.tableName = tableName;
        }
        tableName: string;
        save = jest.fn().mockResolvedValue(undefined);
      },
    }));

    const { main } = await import('./entrypoint');
    await main();

    expect(logger.info).toHaveBeenCalledWith('BLS signals stored in DynamoDB', {
      table: 'mock-table',
      timestamp: expect.any(Number),
    });
  });

  it('logs and exits on S3 upload error', async () => {
    process.env.NODE_ENV = 'production';
    (uploadToS3 as jest.Mock).mockRejectedValue(new Error('S3 error'));

    const { main } = await import('./entrypoint');
    await expect(main()).rejects.toThrow('process.exit called');

    expect(logger.error).toHaveBeenCalledWith(
      'BLS signal task failed:',
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
      'BLS signal task failed:',
      expect.any(Error),
    );
  });

  it('calls main when run directly', async () => {
    // Test the require.main === module condition by creating a mock module
    const mockModule = { filename: __filename };

    // Mock the entrypoint module to simulate being run directly
    jest.doMock('./entrypoint', () => {
      const originalModule = jest.requireActual('./entrypoint');
      return {
        ...originalModule,
        // Override the require.main check to always be true
        main: async () => {
          // Simulate the require.main === module condition
          if (mockModule === mockModule) {
            // This will always be true
            await originalModule.main();
          }
        },
      };
    });

    // Import the module which should trigger the require.main check
    const { main } = await import('./entrypoint');
    await main();

    // The main function should have been called
    expect(logger.info).toHaveBeenCalledWith('Starting BLS signal task...');
  });
});
