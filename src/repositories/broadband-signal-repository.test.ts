import { DynamoDBBroadbandSignalRepository } from './broadband-signal-repository';
import { BroadbandSignalRecord } from '../types/broadband';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
const mockGetCommand = GetCommand as jest.MockedClass<typeof GetCommand>;
const mockPutCommand = PutCommand as jest.MockedClass<typeof PutCommand>;

type RepositoryWithPrivateMembers = DynamoDBBroadbandSignalRepository & {
  client: { send: jest.MockedFunction<(command: unknown) => Promise<unknown>> };
};

describe('DynamoDBBroadbandSignalRepository', () => {
  let repository: DynamoDBBroadbandSignalRepository;
  let mockSend: jest.MockedFunction<(command: unknown) => Promise<unknown>>;
  const mockTableName = 'test-broadband-signals';

  beforeEach(() => {
    repository = new DynamoDBBroadbandSignalRepository(mockTableName);
    mockSend = (repository as RepositoryWithPrivateMembers).client.send;
    jest.clearAllMocks();
  });

  describe('save', () => {
    const mockRecord: BroadbandSignalRecord = {
      state: 'CA',
      timestamp: 1640995200000,
      dataVersion: 'Dec 21v1',
      totalCensusBlocks: 1000,
      blocksWithBroadband: 950,
      broadbandAvailabilityPercent: 95.0,
      blocksWithHighSpeed: 800,
      highSpeedAvailabilityPercent: 80.0,
      blocksWithGigabit: 200,
      gigabitAvailabilityPercent: 20.0,
      technologyCounts: {
        fiber: 200,
        cable: 400,
        dsl: 300,
        wireless: 100,
        other: 50,
      },
      averageDownloadSpeed: 125.5,
      medianDownloadSpeed: 100.0,
      broadbandScore: 0.8765,
    };

    it('should save record successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      await repository.save(mockRecord);

      expect(mockPutCommand).toHaveBeenCalledWith({
        Item: {
          state: 'CA',
          timestamp: 1640995200000,
          dataVersion: 'Dec 21v1',
          totalCensusBlocks: 1000,
          blocksWithBroadband: 950,
          broadbandAvailabilityPercent: 95.0,
          blocksWithHighSpeed: 800,
          highSpeedAvailabilityPercent: 80.0,
          blocksWithGigabit: 200,
          gigabitAvailabilityPercent: 20.0,
          technologyCounts: {
            fiber: 200,
            cable: 400,
            dsl: 300,
            wireless: 100,
            other: 50,
          },
          averageDownloadSpeed: 125.5,
          medianDownloadSpeed: 100.0,
          broadbandScore: 0.8765,
        },
        TableName: mockTableName,
        ConditionExpression:
          'attribute_not_exists(#state) AND attribute_not_exists(#timestamp)',
        ExpressionAttributeNames: {
          '#state': 'state',
          '#timestamp': 'timestamp',
        },
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutCommand));
    });

    it('should handle duplicate records gracefully', async () => {
      const conditionalCheckError = new Error('Conditional check failed');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(conditionalCheckError);

      await expect(repository.save(mockRecord)).resolves.not.toThrow();
    });

    it('should throw error for other DynamoDB errors', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      dynamoDbError.name = 'ServiceUnavailableException';
      mockSend.mockRejectedValueOnce(dynamoDbError);

      await expect(repository.save(mockRecord)).rejects.toThrow(
        'DynamoDB service error',
      );
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      await expect(repository.save(mockRecord)).rejects.toBe('Unknown error');
    });

    it('should save record with minimal data', async () => {
      const minimalRecord: BroadbandSignalRecord = {
        state: 'TX',
        timestamp: 1640995200000,
        dataVersion: 'Dec2021-v1',
        totalCensusBlocks: 0,
        blocksWithBroadband: 0,
        broadbandAvailabilityPercent: 0,
        blocksWithHighSpeed: 0,
        highSpeedAvailabilityPercent: 0,
        blocksWithGigabit: 0,
        gigabitAvailabilityPercent: 0,
        technologyCounts: {
          fiber: 0,
          cable: 0,
          dsl: 0,
          wireless: 0,
          other: 0,
        },
        averageDownloadSpeed: 0,
        medianDownloadSpeed: 0,
        broadbandScore: 0,
      };

      mockSend.mockResolvedValueOnce({});

      await repository.save(minimalRecord);

      expect(mockPutCommand).toHaveBeenCalledWith({
        Item: {
          state: 'TX',
          timestamp: 1640995200000,
          dataVersion: 'Dec2021-v1',
          totalCensusBlocks: 0,
          blocksWithBroadband: 0,
          broadbandAvailabilityPercent: 0,
          blocksWithHighSpeed: 0,
          highSpeedAvailabilityPercent: 0,
          blocksWithGigabit: 0,
          gigabitAvailabilityPercent: 0,
          technologyCounts: {
            fiber: 0,
            cable: 0,
            dsl: 0,
            wireless: 0,
            other: 0,
          },
          averageDownloadSpeed: 0,
          medianDownloadSpeed: 0,
          broadbandScore: 0,
        },
        TableName: mockTableName,
        ConditionExpression:
          'attribute_not_exists(#state) AND attribute_not_exists(#timestamp)',
        ExpressionAttributeNames: {
          '#state': 'state',
          '#timestamp': 'timestamp',
        },
      });
    });
  });

  describe('exists', () => {
    const mockState = 'CA';
    const mockTimestamp = 1640995200000;

    it('should return true when record exists', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          state: mockState,
          timestamp: mockTimestamp,
          broadbandScore: 0.8765,
        },
      });

      const result = await repository.exists(mockState, mockTimestamp);

      expect(result).toBe(true);
      expect(mockGetCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          state: mockState,
          timestamp: mockTimestamp,
        },
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('should return false when record does not exist', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await repository.exists(mockState, mockTimestamp);

      expect(result).toBe(false);
    });

    it('should return false when Item is null', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await repository.exists(mockState, mockTimestamp);

      expect(result).toBe(false);
    });

    it('should throw error when DynamoDB operation fails', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValueOnce(dynamoDbError);

      await expect(repository.exists(mockState, mockTimestamp)).rejects.toThrow(
        'DynamoDB service error',
      );
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      await expect(repository.exists(mockState, mockTimestamp)).rejects.toBe(
        'Unknown error',
      );
    });
  });

  describe('get', () => {
    const mockState = 'CA';
    const mockTimestamp = 1640995200000;
    const mockRecord: BroadbandSignalRecord = {
      state: 'CA',
      timestamp: 1640995200000,
      dataVersion: 'Dec 21v1',
      totalCensusBlocks: 1000,
      blocksWithBroadband: 950,
      broadbandAvailabilityPercent: 95.0,
      blocksWithHighSpeed: 800,
      highSpeedAvailabilityPercent: 80.0,
      blocksWithGigabit: 200,
      gigabitAvailabilityPercent: 20.0,
      technologyCounts: {
        fiber: 200,
        cable: 400,
        dsl: 300,
        wireless: 100,
        other: 50,
      },
      averageDownloadSpeed: 125.5,
      medianDownloadSpeed: 100.0,
      broadbandScore: 0.8765,
    };

    it('should return record when it exists', async () => {
      mockSend.mockResolvedValueOnce({
        Item: mockRecord,
      });

      const result = await repository.get(mockState, mockTimestamp);

      expect(result).toEqual(mockRecord);
      expect(mockGetCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          state: mockState,
          timestamp: mockTimestamp,
        },
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('should return null when record does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await repository.get(mockState, mockTimestamp);

      expect(result).toBeUndefined();
    });

    it('should return null when Item is null', async () => {
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await repository.get(mockState, mockTimestamp);

      expect(result).toBeNull();
    });

    it('should throw error when DynamoDB operation fails', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValueOnce(dynamoDbError);

      await expect(repository.get(mockState, mockTimestamp)).rejects.toThrow(
        'DynamoDB service error',
      );
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      await expect(repository.get(mockState, mockTimestamp)).rejects.toBe(
        'Unknown error',
      );
    });

    it('should handle record with missing optional fields', async () => {
      const recordWithoutOptionalFields = {
        state: 'TX',
        timestamp: 1640995200000,
        totalCensusBlocks: 500,
        blocksWithBroadband: 400,
        broadbandAvailabilityPercent: 80.0,
        blocksWithHighSpeed: 300,
        highSpeedAvailabilityPercent: 60.0,
        blocksWithGigabit: 100,
        gigabitAvailabilityPercent: 20.0,
        technologyCounts: {
          fiber: 100,
          cable: 200,
          dsl: 150,
          wireless: 50,
          other: 25,
        },
        averageDownloadSpeed: 90.0,
        medianDownloadSpeed: 75.0,
        broadbandScore: 0.7234,
      };

      mockSend.mockResolvedValueOnce({
        Item: recordWithoutOptionalFields,
      });

      const result = await repository.get('TX', mockTimestamp);

      expect(result).toEqual(recordWithoutOptionalFields);
    });
  });

  describe('constructor', () => {
    it('should initialize with default region', () => {
      const repo = new DynamoDBBroadbandSignalRepository('test-table');

      expect(repo).toBeInstanceOf(DynamoDBBroadbandSignalRepository);
    });

    it('should initialize with custom region', () => {
      const repo = new DynamoDBBroadbandSignalRepository(
        'test-table',
        'us-east-1',
      );

      expect(repo).toBeInstanceOf(DynamoDBBroadbandSignalRepository);
    });
  });
});
