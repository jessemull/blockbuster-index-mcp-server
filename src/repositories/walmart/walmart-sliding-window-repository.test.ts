import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBWalmartSlidingWindowRepository } from './walmart-sliding-window-repository';
import type { WalmartSlidingWindowAggregate } from '../../types/walmart';

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

const mockedUpdateCommand = UpdateCommand as unknown as jest.Mock;
mockedUpdateCommand.mockImplementation(function (
  this: UpdateCommand,
  input: UpdateCommandInput,
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

describe('DynamoDBWalmartSlidingWindowRepository', () => {
  let repository: DynamoDBWalmartSlidingWindowRepository;
  const tableName = 'test-walmart-sliding-window-table';

  beforeEach(() => {
    repository = new DynamoDBWalmartSlidingWindowRepository(tableName);
    (repository as any).client = mockDynamoDBDocumentClient;
    jest.clearAllMocks();
  });

  describe('getAggregate', () => {
    it('should return aggregate when it exists', async () => {
      const mockAggregate: WalmartSlidingWindowAggregate = {
        state: 'CA',
        windowStart: 1234567890,
        windowEnd: 1234567890,
        totalJobCount: 1500,
        dayCount: 10,
        averageJobCount: 150,
        lastUpdated: Date.now(),
      };
      mockSend.mockResolvedValueOnce({ Item: mockAggregate });

      const result = await repository.getAggregate('CA');

      expect(result).toEqual(mockAggregate);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call).toBeInstanceOf(GetCommand);
      expect(call.TableName).toBe(tableName);
    });

    it('should return null when aggregate does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await repository.getAggregate('CA');

      expect(result).toBeNull();
    });

    it('should throw error on DynamoDB failure', async () => {
      const error = new Error('DynamoDB error');
      mockSend.mockRejectedValueOnce(error);

      await expect(repository.getAggregate('CA')).rejects.toThrow(
        'DynamoDB error',
      );
    });
  });

  describe('saveAggregate', () => {
    const mockAggregate: WalmartSlidingWindowAggregate = {
      state: 'CA',
      windowStart: 1234567890,
      windowEnd: 1234567890,
      totalJobCount: 1500,
      dayCount: 10,
      averageJobCount: 150,
      lastUpdated: Date.now(),
    };

    it('should successfully save an aggregate', async () => {
      mockSend.mockResolvedValueOnce({});

      await repository.saveAggregate(mockAggregate);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call).toBeInstanceOf(PutCommand);
      expect(call.TableName).toBe(tableName);
    });

    it('should handle conditional check failed exception', async () => {
      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(conditionalError);

      await repository.saveAggregate(mockAggregate);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateAggregate', () => {
    const existingAggregate: WalmartSlidingWindowAggregate = {
      state: 'CA',
      windowStart: 1234567890,
      windowEnd: 1234567890,
      totalJobCount: 1500,
      dayCount: 10,
      averageJobCount: 150,
      lastUpdated: Date.now(),
    };

    it('should create new aggregate when none exists', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });
      mockSend.mockResolvedValueOnce({});

      await repository.updateAggregate('CA', 200, 1234567891);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should update existing aggregate', async () => {
      mockSend.mockResolvedValueOnce({ Item: existingAggregate });
      mockSend.mockResolvedValueOnce({});

      await repository.updateAggregate('CA', 200, 1234567891);

      expect(mockSend).toHaveBeenCalledTimes(2);
      const updateCall = mockSend.mock.calls[1][0];
      expect(updateCall).toBeInstanceOf(UpdateCommand);
      expect(updateCall.TableName).toBe(tableName);
    });

    it('should handle sliding window removal', async () => {
      const oldTimestamp = 1234567890 - 90 * 24 * 60 * 60 * 1000;
      const oldAggregate: WalmartSlidingWindowAggregate = {
        ...existingAggregate,
        windowStart: oldTimestamp,
      };
      mockSend.mockResolvedValueOnce({ Item: oldAggregate });
      mockSend.mockResolvedValueOnce({});

      await repository.updateAggregate(
        'CA',
        200,
        1234567891,
        oldTimestamp,
        100,
      );

      expect(mockSend).toHaveBeenCalledTimes(2);
      const updateCall = mockSend.mock.calls[1][0];
      expect(updateCall).toBeInstanceOf(UpdateCommand);
    });
  });

  describe('save', () => {
    it('should call saveAggregate', async () => {
      const mockAggregate: WalmartSlidingWindowAggregate = {
        state: 'CA',
        windowStart: 1234567890,
        windowEnd: 1234567890,
        totalJobCount: 1500,
        dayCount: 10,
        averageJobCount: 150,
        lastUpdated: Date.now(),
      };
      mockSend.mockResolvedValueOnce({});

      await repository.save(mockAggregate);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('exists', () => {
    it('should return true when aggregate exists', async () => {
      mockSend.mockResolvedValueOnce({ Item: { state: 'CA' } });

      const result = await repository.exists('CA');

      expect(result).toBe(true);
    });

    it('should return false when aggregate does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await repository.exists('CA');

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return aggregate when it exists', async () => {
      const mockAggregate: WalmartSlidingWindowAggregate = {
        state: 'CA',
        windowStart: 1234567890,
        windowEnd: 1234567890,
        totalJobCount: 1500,
        dayCount: 10,
        averageJobCount: 150,
        lastUpdated: Date.now(),
      };
      mockSend.mockResolvedValueOnce({ Item: mockAggregate });

      const result = await repository.get('CA');

      expect(result).toEqual(mockAggregate);
    });
  });
});
