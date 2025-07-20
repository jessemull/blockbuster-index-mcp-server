import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBAmazonSlidingWindowRepository } from './amazon-sliding-window-repository';
import { logger } from '../../util';
import type { SlidingWindowAggregate } from '../../types/amazon';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

const mockedGetCommand = GetCommand as unknown as jest.Mock;
mockedGetCommand.mockImplementation(function (
  this: GetCommand,
  input: GetCommandInput,
) {
  Object.assign(this, input);
});

const mockedPutCommand = PutCommand as unknown as jest.Mock;
mockedPutCommand.mockImplementation(function (
  this: PutCommand,
  input: PutCommandInput,
) {
  Object.assign(this, input);
});

const mockedUpdateCommand = UpdateCommand as unknown as jest.Mock;
mockedUpdateCommand.mockImplementation(function (
  this: any,
  input: UpdateCommandInput,
) {
  this.input = input;
  return this;
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

describe('DynamoDBAmazonSlidingWindowRepository', () => {
  const tableName = 'test-table';
  let repository: DynamoDBAmazonSlidingWindowRepository;

  const aggregate: SlidingWindowAggregate = {
    state: 'CA',
    windowStart: 0,
    windowEnd: 1000,
    totalJobCount: 10,
    dayCount: 2,
    averageJobCount: 5,
    lastUpdated: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DynamoDBAmazonSlidingWindowRepository(tableName);
  });

  describe('getAggregate', () => {
    it('returns aggregate when found', async () => {
      mockSend.mockResolvedValue({ Item: aggregate });
      const result = await repository.getAggregate('CA');
      expect(result).toEqual(aggregate);
    });

    it('returns null when not found', async () => {
      mockSend.mockResolvedValue({});
      const result = await repository.getAggregate('CA');
      expect(result).toBeNull();
    });

    it('logs and throws on error', async () => {
      mockSend.mockRejectedValue(new Error('get error'));
      await expect(repository.getAggregate('CA')).rejects.toThrow('get error');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to get sliding window aggregate',
        expect.objectContaining({ state: 'CA' }),
      );
    });
  });

  describe('saveAggregate', () => {
    it('saves successfully', async () => {
      mockSend.mockResolvedValue({});
      await repository.saveAggregate(aggregate);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully saved sliding window aggregate',
        expect.objectContaining({ state: 'CA' }),
      );
    });

    it('logs and skips duplicate if ConditionalCheckFailedException', async () => {
      const error = new Error('cond check');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(error);
      await repository.saveAggregate(aggregate);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Sliding window aggregate already exists, skipping duplicate',
        { state: 'CA' },
      );
    });

    it('logs and throws other errors', async () => {
      const error = new Error('other error');
      mockSend.mockRejectedValue(error);
      await expect(repository.saveAggregate(aggregate)).rejects.toThrow(
        'other error',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to save sliding window aggregate',
        expect.objectContaining({ state: 'CA' }),
      );
    });
  });

  describe('updateAggregate', () => {
    it('creates new aggregate when none exists', async () => {
      mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(null);
      const spy = jest.spyOn(repository, 'saveAggregate');
      await repository.updateAggregate('CA', 10, 12345);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'CA' }),
      );
    });

    it('updates aggregate without old day', async () => {
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(aggregate);
      mockSend.mockResolvedValue({});
      await repository.updateAggregate('CA', 5, 2000);
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully updated sliding window aggregate',
        expect.objectContaining({ state: 'CA', oldDayRemoved: false }),
      );
    });

    it('updates aggregate with old day and includes windowStart updates', async () => {
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(aggregate);
      mockSend.mockResolvedValue({});

      await repository.updateAggregate('CA', 5, 2000, 1000, 5);
      const sentCommand = mockSend.mock.calls[0][0] as UpdateCommand;
      expect(sentCommand.input.UpdateExpression).toMatch(
        /#windowStart = :windowStart/,
      );
      expect(sentCommand.input.ExpressionAttributeNames!['#windowStart']).toBe(
        'windowStart',
      );
      expect(
        sentCommand.input.ExpressionAttributeValues![':windowStart'],
      ).toBeDefined();
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully updated sliding window aggregate',
        expect.objectContaining({
          state: 'CA',
          oldDayRemoved: true,
        }),
      );
    });

    it('logs and throws on update failure', async () => {
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(aggregate);
      mockSend.mockRejectedValue(new Error('update error'));
      await expect(repository.updateAggregate('CA', 5, 2000)).rejects.toThrow(
        'update error',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to update sliding window aggregate',
        expect.objectContaining({ state: 'CA' }),
      );
    });
  });

  describe('save', () => {
    it('delegates to saveAggregate', async () => {
      const spy = jest.spyOn(repository, 'saveAggregate').mockResolvedValue();
      await repository.save(aggregate);
      expect(spy).toHaveBeenCalledWith(aggregate);
    });
  });

  describe('exists', () => {
    it('returns true when aggregate exists', async () => {
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(aggregate);
      const result = await repository.exists('CA');
      expect(result).toBe(true);
    });

    it('returns false when aggregate does not exist', async () => {
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(null);
      const result = await repository.exists('CA');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('delegates to getAggregate and returns aggregate when found', async () => {
      const spy = jest
        .spyOn(repository, 'getAggregate')
        .mockResolvedValueOnce(aggregate);
      const result = await repository.get('CA');
      expect(spy).toHaveBeenCalledWith('CA');
      expect(result).toEqual(aggregate);
    });

    it('delegates to getAggregate and returns null when not found', async () => {
      const spy = jest
        .spyOn(repository, 'getAggregate')
        .mockResolvedValueOnce(null);
      const result = await repository.get('CA');
      expect(spy).toHaveBeenCalledWith('CA');
      expect(result).toBeNull();
    });
  });

  describe('error logging fallback for non-Error types', () => {
    it('logs stringified unknown error in getAggregate', async () => {
      const unknownError = 'unexpected string error';
      mockSend.mockRejectedValue(unknownError);

      await expect(repository.getAggregate('TX')).rejects.toBe(unknownError);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to get sliding window aggregate',
        expect.objectContaining({ error: String(unknownError), state: 'TX' }),
      );
    });

    it('logs stringified unknown error in saveAggregate', async () => {
      const unknownError = 12345;
      mockSend.mockRejectedValue(unknownError);

      await expect(repository.saveAggregate(aggregate)).rejects.toBe(
        unknownError,
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to save sliding window aggregate',
        expect.objectContaining({ error: String(12345), state: 'CA' }),
      );
    });

    it('logs stringified unknown error in updateAggregate', async () => {
      jest.spyOn(repository, 'getAggregate').mockResolvedValueOnce(aggregate);
      const unknownError = { some: 'weird object' };
      mockSend.mockRejectedValue(unknownError);

      await expect(repository.updateAggregate('CA', 5, 2000)).rejects.toBe(
        unknownError,
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to update sliding window aggregate',
        expect.objectContaining({
          error: String(unknownError),
          state: 'CA',
          newDayJobCount: 5,
          newDayTimestamp: 2000,
        }),
      );
    });
  });
});
