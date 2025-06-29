import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  PutCommandInput,
  GetCommandInput,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBAmazonSignalRepository } from './amazon-signal-repository';
import { DynamoDBCensusSignalRepository } from './census-signal-repository';
import { logger } from '../util';

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

const mockedQueryCommand = QueryCommand as unknown as jest.Mock;
mockedQueryCommand.mockImplementation(function (
  this: QueryCommand,
  input: QueryCommandInput,
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

jest.mock('../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('DynamoDBAmazonSignalRepository', () => {
  let repository: DynamoDBAmazonSignalRepository;
  const mockTableName = 'test-table';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DynamoDBAmazonSignalRepository(mockTableName, 'us-east-1');
  });

  describe('constructor', () => {
    it('creates DynamoDB client with default region', () => {
      new DynamoDBAmazonSignalRepository(mockTableName);
      expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'us-west-2' });
    });

    it('creates DynamoDB client with custom region', () => {
      new DynamoDBAmazonSignalRepository(mockTableName, 'us-east-1');
      expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'us-east-1' });
    });
  });

  describe('save', () => {
    const mockRecord = {
      state: 'CA',
      timestamp: 1234567890,
      jobCount: 42,
    };

    it('successfully saves a record', async () => {
      mockSend.mockResolvedValue({});

      await repository.save(mockRecord);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call).toBeInstanceOf(PutCommand);
      expect(call.TableName).toBe(mockTableName);
      expect(call.Item).toEqual(mockRecord);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully saved job signal record',
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
        'Failed to save job signal record',
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
        'Failed to save job signal record',
        {
          error: 'String error',
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });
  });

  describe('exists', () => {
    it('returns true when record exists', async () => {
      mockSend.mockResolvedValue({
        Item: { state: 'CA', timestamp: 1234567890 },
      });

      const result = await repository.exists('CA', 1234567890);
      expect(result).toBe(true);
    });

    it('returns false when record does not exist', async () => {
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
        'Failed to check if record exists',
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
        'Failed to check if record exists',
        {
          error: 'String error',
          state: 'CA',
          timestamp: 1234567890,
        },
      );
    });
  });

  describe('query', () => {
    it('successfully queries records with default time range', async () => {
      const mockItems = [
        { state: 'CA', timestamp: 1234567890, jobCount: 42 },
        { state: 'CA', timestamp: 1234567891, jobCount: 43 },
      ];
      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await repository.query('CA');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call).toBeInstanceOf(QueryCommand);
      expect(call.TableName).toBe(mockTableName);
      expect(call.KeyConditionExpression).toBe(
        'state = :state AND #ts BETWEEN :start AND :end',
      );
      expect(call.ExpressionAttributeValues).toEqual({
        ':state': 'CA',
        ':start': 0,
        ':end': expect.any(Number),
      });
      expect(call.ExpressionAttributeNames).toEqual({
        '#ts': 'timestamp',
      });
      expect(result).toEqual(mockItems);
    });

    it('successfully queries records with custom time range', async () => {
      const mockItems = [{ state: 'CA', timestamp: 1234567890, jobCount: 42 }];
      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await repository.query('CA', 1234567890, 1234567891);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.ExpressionAttributeValues).toEqual({
        ':state': 'CA',
        ':start': 1234567890,
        ':end': 1234567891,
      });
      expect(result).toEqual(mockItems);
    });

    it('returns empty array when no records found', async () => {
      mockSend.mockResolvedValue({ Items: null });

      const result = await repository.query('CA');

      expect(result).toEqual([]);
    });

    it('throws error on query failure', async () => {
      const error = new Error('Query failed');
      mockSend.mockRejectedValue(error);

      await expect(repository.query('CA')).rejects.toThrow('Query failed');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to query job signal records',
        {
          error: 'Query failed',
          state: 'CA',
          start: undefined,
          end: undefined,
        },
      );
    });

    it('handles non-Error exceptions in query', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      await expect(repository.query('CA')).rejects.toBe('String error');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to query job signal records',
        {
          error: 'String error',
          state: 'CA',
          start: undefined,
          end: undefined,
        },
      );
    });
  });
});

describe('DynamoDBCensusSignalRepository', () => {
  let repository: DynamoDBCensusSignalRepository;
  const mockTableName = 'test-census-table';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DynamoDBCensusSignalRepository(mockTableName, 'us-east-1');
  });

  describe('save', () => {
    const mockRecord = {
      state: 'TX',
      timestamp: 1234567890,
      retailStores: 100,
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
          state: 'TX',
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
          state: 'TX',
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
          state: 'TX',
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
          state: 'TX',
          timestamp: 1234567890,
        },
      );
    });

    it('handles non-Error exceptions in exists check', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('TX', 1234567890)).rejects.toBe(
        'String error',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to check if census record exists',
        {
          error: 'String error',
          state: 'TX',
          timestamp: 1234567890,
        },
      );
    });

    it('handles non-Error exceptions in save', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      const mockRecord = {
        state: 'TX',
        timestamp: 1234567890,
        retailStores: 100,
      };

      await expect(repository.save(mockRecord)).rejects.toBe('String error');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to save census signal record',
        {
          error: 'String error',
          state: 'TX',
          timestamp: 1234567890,
        },
      );
    });
  });

  describe('exists', () => {
    it('returns true when census record exists', async () => {
      mockSend.mockResolvedValue({
        Item: { state: 'TX', timestamp: 1234567890 },
      });

      const result = await repository.exists('TX', 1234567890);
      expect(result).toBe(true);
    });

    it('returns false when census record does not exist', async () => {
      mockSend.mockResolvedValue({ Item: null });

      const result = await repository.exists('TX', 1234567890);
      expect(result).toBe(false);
    });

    it('uses current timestamp when timestamp is not provided', async () => {
      mockSend.mockResolvedValue({
        Item: { state: 'TX', timestamp: 1751089342 },
      });

      await repository.exists('TX');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws error on exists check failure', async () => {
      const error = new Error('Get failed');
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('TX', 1234567890)).rejects.toThrow(
        'Get failed',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to check if census record exists',
        {
          error: 'Get failed',
          state: 'TX',
          timestamp: 1234567890,
        },
      );
    });

    it('handles non-Error exceptions in exists check', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('TX', 1234567890)).rejects.toBe(
        'String error',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to check if census record exists',
        {
          error: 'String error',
          state: 'TX',
          timestamp: 1234567890,
        },
      );
    });
  });
});
