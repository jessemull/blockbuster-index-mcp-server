import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  PutCommandInput,
  GetCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBCensusSignalRepository } from './census-signal-repository';
import { logger } from '../../util';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

const mockedPutCommand = PutCommand as unknown as jest.Mock;
mockedPutCommand.mockImplementation(function (
  this: PutCommand,
  input: PutCommandInput,
) {
  Object.assign(this, input);
});

const mockedGetCommand = GetCommand as unknown as jest.Mock;
mockedGetCommand.mockImplementation(function (
  this: GetCommand,
  input: GetCommandInput,
) {
  Object.assign(this, input);
});

const mockSend = jest.fn();
const mockDynamoDBDocumentClient: jest.Mocked<DynamoDBDocumentClient> = {
  send: mockSend,
} as unknown as jest.Mocked<DynamoDBDocumentClient>;

(DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(
  mockDynamoDBDocumentClient,
);

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('DynamoDBCensusSignalRepository', () => {
  let repository: DynamoDBCensusSignalRepository;
  const mockTableName = 'test-census-table';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DynamoDBCensusSignalRepository(mockTableName, 'us-east-1');
  });

  describe('constructor', () => {
    it('creates DynamoDB client with default region', () => {
      new DynamoDBCensusSignalRepository(mockTableName);
      expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'us-west-2' });
    });

    it('creates DynamoDB client with custom region', () => {
      new DynamoDBCensusSignalRepository(mockTableName, 'us-east-1');
      expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'us-east-1' });
    });
  });

  describe('save', () => {
    const mockRecord = {
      retailStores: 100,
      state: 'CA',
      timestamp: 1234567890,
    };

    it('successfully saves a census record', async () => {
      mockSend.mockResolvedValue({});

      await repository.save(mockRecord);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call).toBeInstanceOf(PutCommand);
      expect(call.TableName).toBe(mockTableName);
      expect(call.Item).toEqual(mockRecord);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully saved census signal record',
        {
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });

    it('handles conditional check failed exception gracefully', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(error);

      await repository.save(mockRecord);

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Record already exists, skipping duplicate',
        {
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });

    it('throws error for other exceptions', async () => {
      const error = new Error('DynamoDB error');
      mockSend.mockRejectedValue(error);

      await expect(repository.save(mockRecord)).rejects.toThrow(
        'DynamoDB error',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to save census signal record',
        {
          error: 'DynamoDB error',
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });

    it('handles non-Error exceptions', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      await expect(repository.save(mockRecord)).rejects.toBe('String error');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to save census signal record',
        {
          error: 'String error',
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });
  });

  describe('exists', () => {
    it('returns true when census record exists', async () => {
      mockSend.mockResolvedValue({
        Item: { state: 'CA', timestamp: 1234567890 },
      });

      const result = await repository.exists('CA', 1234567890);
      expect(result).toBe(true);
    });

    it('returns false when census record does not exist', async () => {
      mockSend.mockResolvedValue({ Item: null });

      const result = await repository.exists('CA', 1234567890);
      expect(result).toBe(false);
    });

    it('uses current timestamp when timestamp is not provided', async () => {
      mockSend.mockResolvedValue({
        Item: { state: 'CA', timestamp: 1751089342 },
      });

      await repository.exists('CA');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws error on exists check failure', async () => {
      const error = new Error('Get failed');
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('CA', 1234567890)).rejects.toThrow(
        'Get failed',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to check if census record exists',
        {
          error: 'Get failed',
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });

    it('handles non-Error exceptions in exists check', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('CA', 1234567890)).rejects.toBe(
        'String error',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to check if census record exists',
        {
          error: 'String error',
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });
  });
});
