import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  PutCommandInput,
  GetCommandInput,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBWalmartTechnologyRepository } from './walmart-technology-repository';
import type { WalmartTechnologyJobRecord } from '../../types/walmart';

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

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('DynamoDBWalmartTechnologyRepository', () => {
  let repository: DynamoDBWalmartTechnologyRepository;
  const tableName = 'test-walmart-technology-table';

  beforeEach(() => {
    repository = new DynamoDBWalmartTechnologyRepository(tableName);
    (repository as any).client = mockDynamoDBDocumentClient;
    jest.clearAllMocks();
  });

  describe('save', () => {
    const mockRecord: WalmartTechnologyJobRecord = {
      state: 'CA',
      timestamp: 1234567890,
      jobCount: 75,
    };

    it('should successfully save a record', async () => {
      mockSend.mockResolvedValueOnce({});

      await repository.save(mockRecord);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call).toBeInstanceOf(PutCommand);
      expect(call.TableName).toBe(tableName);
      expect(call.Item).toEqual(mockRecord);
    });

    it('should handle conditional check failed exception', async () => {
      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(conditionalError);

      await repository.save(mockRecord);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw other errors', async () => {
      const error = new Error('DynamoDB error');
      mockSend.mockRejectedValueOnce(error);

      await expect(repository.save(mockRecord)).rejects.toThrow(
        'DynamoDB error',
      );
    });
  });

  describe('exists', () => {
    it('should return true when record exists', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { state: 'CA', timestamp: 1234567890, jobCount: 75 },
      });

      const result = await repository.exists('CA', 1234567890);

      expect(result).toBe(true);
    });

    it('should return false when record does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await repository.exists('CA', 1234567890);

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return record when it exists', async () => {
      const mockItem = {
        state: 'CA',
        timestamp: 1234567890,
        jobCount: 75,
      };
      mockSend.mockResolvedValueOnce({ Item: mockItem });

      const result = await repository.get('CA', 1234567890);

      expect(result).toEqual({
        state: 'CA',
        timestamp: 1234567890,
        jobCount: 75,
      });
    });

    it('should return null when record does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await repository.get('CA', 1234567890);

      expect(result).toBeNull();
    });
  });

  describe('query', () => {
    it('should query records within time range', async () => {
      const mockItems = [
        { state: 'CA', timestamp: 1234567890, jobCount: 75 },
        { state: 'CA', timestamp: 1234567891, jobCount: 80 },
      ];
      mockSend.mockResolvedValueOnce({ Items: mockItems });

      const result = await repository.query('CA', 1234567890, 1234567892);

      expect(result).toEqual([
        { state: 'CA', timestamp: 1234567890, jobCount: 75 },
        { state: 'CA', timestamp: 1234567891, jobCount: 80 },
      ]);
    });
  });
});
