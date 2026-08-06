import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import { DynamoDBJobRepository } from './generic-job-repository';

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
(DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
  send: mockSend,
});

jest.mock('../../util', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('DynamoDBJobRepository', () => {
  const tableName = 'jobs-table';
  let repository: DynamoDBJobRepository<{
    jobCount: number;
    state: string;
    timestamp: number;
  }>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DynamoDBJobRepository(tableName, 'us-west-2');
  });

  describe('save', () => {
    it('should save a job record when the put succeeds', async () => {
      mockSend.mockResolvedValue({});
      const record = { jobCount: 10, state: 'CA', timestamp: 100 };

      await repository.save(record);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutCommand);
      expect(command.TableName).toBe(tableName);
      expect(command.Item).toEqual(record);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully saved job record',
        { state: 'CA', timestamp: 100 },
      );
    });

    it('should skip duplicates when ConditionalCheckFailedException is thrown', async () => {
      const error = new Error('duplicate');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(error);

      await expect(
        repository.save({ jobCount: 1, state: 'TX', timestamp: 200 }),
      ).resolves.toBeUndefined();

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Record already exists, skipping duplicate',
        { state: 'TX', timestamp: 200 },
      );
    });

    it('should rethrow unexpected save errors', async () => {
      mockSend.mockRejectedValue(new Error('boom'));

      await expect(
        repository.save({ jobCount: 1, state: 'NY', timestamp: 300 }),
      ).rejects.toThrow('boom');
    });
  });

  describe('exists', () => {
    it('should return true when an item exists', async () => {
      mockSend.mockResolvedValue({ Item: { state: 'CA' } });

      await expect(repository.exists('CA', 100)).resolves.toBe(true);
    });

    it('should return false when an item is missing', async () => {
      mockSend.mockResolvedValue({});

      await expect(repository.exists('CA', 100)).resolves.toBe(false);
    });
  });

  describe('get', () => {
    it('should return a typed record when found', async () => {
      mockSend.mockResolvedValue({
        Item: { jobCount: 5, state: 'CA', timestamp: 100 },
      });

      await expect(repository.get('CA', 100)).resolves.toEqual({
        jobCount: 5,
        state: 'CA',
        timestamp: 100,
      });
    });

    it('should return null when no item is found', async () => {
      mockSend.mockResolvedValue({});

      await expect(repository.get('CA', 100)).resolves.toBeNull();
    });
  });

  describe('query', () => {
    it('should map query items to job records', async () => {
      mockSend.mockResolvedValue({
        Items: [
          { jobCount: 1, state: 'CA', timestamp: 10 },
          { jobCount: 2, state: 'CA', timestamp: 20 },
        ],
      });

      await expect(repository.query('CA', 0, 50)).resolves.toEqual([
        { jobCount: 1, state: 'CA', timestamp: 10 },
        { jobCount: 2, state: 'CA', timestamp: 20 },
      ]);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(QueryCommand);
      expect(command.TableName).toBe(tableName);
    });
  });
});
