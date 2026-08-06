import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import {
  DynamoDBSlidingWindowRepository,
  SlidingWindowKeyStrategy,
} from './generic-sliding-window-repository';

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
  this: UpdateCommand,
  input: UpdateCommandInput,
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

interface TestAggregate {
  averageJobCount: number;
  dayCount: number;
  lastUpdated: number;
  state: string;
  totalJobCount: number;
  windowEnd: number;
  windowStart: number;
}

const keyStrategy: SlidingWindowKeyStrategy<TestAggregate> = {
  extractAggregate: (response) => {
    const item = (response as { Item?: TestAggregate }).Item;
    return item ?? null;
  },
  getAggregateCommand: (state, tableName) =>
    new GetCommand({
      Key: { state },
      TableName: tableName,
    }),
};

describe('DynamoDBSlidingWindowRepository', () => {
  const tableName = 'sliding-window-table';
  let repository: DynamoDBSlidingWindowRepository<TestAggregate>;

  const aggregate: TestAggregate = {
    averageJobCount: 5,
    dayCount: 2,
    lastUpdated: 1_000,
    state: 'CA',
    totalJobCount: 10,
    windowEnd: 200,
    windowStart: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DynamoDBSlidingWindowRepository(
      tableName,
      keyStrategy,
      'us-west-2',
    );
  });

  describe('getAggregate', () => {
    it('should return an aggregate extracted by the key strategy', async () => {
      mockSend.mockResolvedValue({ Item: aggregate });

      await expect(repository.getAggregate('CA')).resolves.toEqual(aggregate);
    });

    it('should return null when the key strategy finds nothing', async () => {
      mockSend.mockResolvedValue({});

      await expect(repository.getAggregate('CA')).resolves.toBeNull();
    });
  });

  describe('saveAggregate', () => {
    it('should put the aggregate item', async () => {
      mockSend.mockResolvedValue({});

      await repository.saveAggregate(aggregate);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutCommand);
      expect(command.TableName).toBe(tableName);
      expect(command.Item).toEqual(aggregate);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Successfully saved sliding window aggregate',
        { state: 'CA', windowStart: 100 },
      );
    });
  });

  describe('updateAggregate', () => {
    it('should create a new aggregate when none exists', async () => {
      mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});

      await repository.updateAggregate('CA', 7, 500);

      expect(mockSend).toHaveBeenCalledTimes(2);
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand).toBeInstanceOf(PutCommand);
      expect(putCommand.Item).toMatchObject({
        averageJobCount: 7,
        dayCount: 1,
        state: 'CA',
        totalJobCount: 7,
        windowEnd: 500,
        windowStart: 500,
      });
    });

    it('should update totals when an aggregate already exists', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: aggregate })
        .mockResolvedValueOnce({});

      await repository.updateAggregate('CA', 5, 300);

      const updateCommand = mockSend.mock.calls[1][0];
      expect(updateCommand).toBeInstanceOf(UpdateCommand);
      expect(updateCommand.TableName).toBe(tableName);
      expect(updateCommand.ExpressionAttributeValues).toMatchObject({
        ':dayCount': 3,
        ':totalJobCount': 15,
        ':windowEnd': 300,
      });
    });
  });

  describe('abstract wrappers', () => {
    it('should delegate save/exists/get to aggregate methods', async () => {
      mockSend.mockResolvedValue({ Item: aggregate });

      await repository.save(aggregate);
      await expect(repository.exists('CA')).resolves.toBe(true);
      await expect(repository.get('CA')).resolves.toEqual(aggregate);
    });
  });
});
