import { DynamoDBBroadbandSignalRepository } from './broadband-signal-repository';
import { BroadbandSignalRecord } from '../../types/broadband';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
const mockGetCommand = GetCommand as jest.MockedClass<typeof GetCommand>;
const mockPutCommand = PutCommand as jest.MockedClass<typeof PutCommand>;

const mockedQueryCommand = QueryCommand as unknown as jest.Mock;
mockedQueryCommand.mockImplementation(function (
  this: QueryCommand,
  input: any,
) {
  Object.assign(this, input);
});

const mockedScanCommand = ScanCommand as unknown as jest.Mock;
mockedScanCommand.mockImplementation(function (this: ScanCommand, input: any) {
  Object.assign(this, input);
});

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

  describe('getLatestVersionForState', () => {
    const mockState = 'CA';

    it('should return latest version when records exist', async () => {
      const mockItems = [
        {
          state: 'CA',
          dataVersion: 'Dec2021-v2',
          timestamp: 1640995200000,
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: mockItems,
      });

      const result = await repository.getLatestVersionForState(mockState);

      expect(result).toBe('Dec2021-v2');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'state-dataVersion-index',
          KeyConditionExpression: '#state = :state',
          ExpressionAttributeNames: {
            '#state': 'state',
          },
          ExpressionAttributeValues: {
            ':state': 'CA',
          },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );
    });

    it('should return null when no records exist', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
      });

      const result = await repository.getLatestVersionForState(mockState);

      expect(result).toBeNull();
    });

    it('should return null when Items is undefined', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await repository.getLatestVersionForState(mockState);

      expect(result).toBeNull();
    });

    it('should handle records without dataVersion', async () => {
      const mockItems = [
        {
          state: 'CA',
          timestamp: 1640995200000,
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: mockItems,
      });

      const result = await repository.getLatestVersionForState(mockState);

      expect(result).toBeNull();
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValueOnce(dynamoDbError);

      const result = await repository.getLatestVersionForState(mockState);

      expect(result).toBeNull();
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      const result = await repository.getLatestVersionForState(mockState);

      expect(result).toBeNull();
    });
  });

  describe('saveStateVersionMetadata', () => {
    const mockMetadata = {
      state: 'CA',
      dataVersion: 'Dec2021-v1',
      lastProcessed: 1640995200000,
    };

    it('should save metadata successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      await repository.saveStateVersionMetadata(mockMetadata);

      expect(mockPutCommand).toHaveBeenCalledWith({
        Item: {
          state: 'CA',
          timestamp: 1640995200000,
          dataVersion: 'Dec2021-v1',
          isMetadata: true,
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

    it('should handle duplicate metadata gracefully', async () => {
      const conditionalCheckError = new Error('Conditional check failed');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(conditionalCheckError);

      await expect(
        repository.saveStateVersionMetadata(mockMetadata),
      ).resolves.not.toThrow();
    });

    it('should throw error for other DynamoDB errors', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValueOnce(dynamoDbError);

      await expect(
        repository.saveStateVersionMetadata(mockMetadata),
      ).rejects.toThrow('DynamoDB service error');
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      await expect(
        repository.saveStateVersionMetadata(mockMetadata),
      ).rejects.toBe('Unknown error');
    });
  });

  describe('getAllScores', () => {
    it('should return scores for all states', async () => {
      const mockItems = [
        {
          state: 'CA',
          broadbandScore: 0.8765,
          dataVersion: 'Dec2021-v1',
        },
        {
          state: 'TX',
          broadbandScore: 0.7234,
          dataVersion: 'Dec2021-v1',
        },
        {
          state: 'NY',
          broadbandScore: 0.9123,
          dataVersion: 'Dec2021-v1',
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });

      const result = await repository.getAllScores();

      // Check that all states are initialized with 0...

      expect(result.AK).toBe(0);
      expect(result.AL).toBe(0);
      expect(result.AZ).toBe(0);
      expect(result.AR).toBe(0);
      expect(result.CA).toBe(0.8765);
      expect(result.CO).toBe(0);
      expect(result.CT).toBe(0);
      expect(result.DE).toBe(0);
      expect(result.FL).toBe(0);
      expect(result.GA).toBe(0);
      expect(result.HI).toBe(0);
      expect(result.IA).toBe(0);
      expect(result.ID).toBe(0);
      expect(result.IL).toBe(0);
      expect(result.IN).toBe(0);
      expect(result.KS).toBe(0);
      expect(result.KY).toBe(0);
      expect(result.LA).toBe(0);
      expect(result.MA).toBe(0);
      expect(result.MD).toBe(0);
      expect(result.ME).toBe(0);
      expect(result.MI).toBe(0);
      expect(result.MN).toBe(0);
      expect(result.MO).toBe(0);
      expect(result.MS).toBe(0);
      expect(result.MT).toBe(0);
      expect(result.NC).toBe(0);
      expect(result.ND).toBe(0);
      expect(result.NE).toBe(0);
      expect(result.NH).toBe(0);
      expect(result.NJ).toBe(0);
      expect(result.NM).toBe(0);
      expect(result.NV).toBe(0);
      expect(result.NY).toBe(0.9123);
      expect(result.OH).toBe(0);
      expect(result.OK).toBe(0);
      expect(result.OR).toBe(0);
      expect(result.PA).toBe(0);
      expect(result.RI).toBe(0);
      expect(result.SC).toBe(0);
      expect(result.SD).toBe(0);
      expect(result.TN).toBe(0);
      expect(result.TX).toBe(0.7234);
      expect(result.UT).toBe(0);
      expect(result.VA).toBe(0);
      expect(result.VT).toBe(0);
      expect(result.WA).toBe(0);
      expect(result.WI).toBe(0);
      expect(result.WV).toBe(0);
      expect(result.WY).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      const firstPageItems = [
        {
          state: 'CA',
          broadbandScore: 0.8765,
          dataVersion: 'Dec2021-v1',
        },
      ];

      const secondPageItems = [
        {
          state: 'TX',
          broadbandScore: 0.7234,
          dataVersion: 'Dec2021-v1',
        },
      ];

      mockSend
        .mockResolvedValueOnce({
          Items: firstPageItems,
          LastEvaluatedKey: { state: 'CA' },
        })
        .mockResolvedValueOnce({
          Items: secondPageItems,
          LastEvaluatedKey: undefined,
        });

      const result = await repository.getAllScores();

      expect(result.CA).toBe(0.8765);
      expect(result.TX).toBe(0.7234);
      expect(result.AK).toBe(0);
    });

    it('should filter records by dataVersion', async () => {
      const mockItems = [
        {
          state: 'CA',
          broadbandScore: 0.8765,
          dataVersion: 'Dec2021-v1',
        },
        {
          state: 'TX',
          broadbandScore: 0.7234,
          dataVersion: 'Dec2021-v1',
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });

      await repository.getAllScores();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: '#dataVersion = :dataVersion',
          ExpressionAttributeNames: {
            '#dataVersion': 'dataVersion',
          },
          ExpressionAttributeValues: {
            ':dataVersion': 'Dec2021-v1',
          },
        }),
      );
    });

    it('should handle records without broadband scores', async () => {
      const mockItems = [
        {
          state: 'CA',
          dataVersion: 'Dec2021-v1',
        },
        {
          state: 'TX',
          broadbandScore: 0.7234,
          dataVersion: 'Dec2021-v1',
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });

      const result = await repository.getAllScores();

      expect(result.CA).toBe(0);
      expect(result.TX).toBe(0.7234);
      expect(result.AK).toBe(0);
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValueOnce(dynamoDbError);

      const result = await repository.getAllScores();

      expect(result).toEqual({});
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      const result = await repository.getAllScores();

      expect(result).toEqual({});
    });
  });

  describe('getByStateAndVersion', () => {
    const mockState = 'CA';
    const mockDataVersion = 'Dec2021-v1';

    it('should return record when it exists', async () => {
      const mockRecord = {
        state: 'CA',
        timestamp: 1640995200000,
        dataVersion: 'Dec2021-v1',
        broadbandScore: 0.8765,
      };

      mockSend.mockResolvedValueOnce({
        Items: [mockRecord],
      });

      const result = await repository.getByStateAndVersion(
        mockState,
        mockDataVersion,
      );

      expect(result).toEqual(mockRecord);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'state-dataVersion-index',
          KeyConditionExpression:
            '#state = :state AND #dataVersion = :dataVersion',
          ExpressionAttributeNames: {
            '#state': 'state',
            '#dataVersion': 'dataVersion',
          },
          ExpressionAttributeValues: {
            ':state': 'CA',
            ':dataVersion': 'Dec2021-v1',
          },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );
    });

    it('should return null when no records exist', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
      });

      const result = await repository.getByStateAndVersion(
        mockState,
        mockDataVersion,
      );

      expect(result).toBeNull();
    });

    it('should return null when Items is undefined', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await repository.getByStateAndVersion(
        mockState,
        mockDataVersion,
      );

      expect(result).toBeNull();
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const dynamoDbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValueOnce(dynamoDbError);

      const result = await repository.getByStateAndVersion(
        mockState,
        mockDataVersion,
      );

      expect(result).toBeNull();
    });

    it('should handle unknown error types', async () => {
      mockSend.mockRejectedValueOnce('Unknown error');

      const result = await repository.getByStateAndVersion(
        mockState,
        mockDataVersion,
      );

      expect(result).toBeNull();
    });

    it('should use correct query parameters', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
      });

      await repository.getByStateAndVersion(mockState, mockDataVersion);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'state-dataVersion-index',
          KeyConditionExpression:
            '#state = :state AND #dataVersion = :dataVersion',
          ExpressionAttributeNames: {
            '#state': 'state',
            '#dataVersion': 'dataVersion',
          },
          ExpressionAttributeValues: {
            ':state': 'CA',
            ':dataVersion': 'Dec2021-v1',
          },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );
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
