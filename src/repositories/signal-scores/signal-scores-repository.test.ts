import { DynamoDBSignalScoresRepository } from './signal-scores-repository';
import { logger } from '../../util';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    config: {},
  })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  },
  GetCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  PutCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ input: params })),
}));

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DynamoDBSignalScoresRepository', () => {
  let repository: DynamoDBSignalScoresRepository;
  let mockSend: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock send function
    mockSend = jest.fn();

    // Mock the DynamoDBDocumentClient.from to return an object with our mock send
    const { DynamoDBDocumentClient } = jest.requireMock(
      '@aws-sdk/lib-dynamodb',
    );
    DynamoDBDocumentClient.from.mockReturnValue({
      send: mockSend,
    });

    repository = new DynamoDBSignalScoresRepository('test-table');
  });

  describe('constructor', () => {
    it('should create repository with correct table name', () => {
      expect(repository['tableName']).toBe('test-table');
    });

    it('should have DynamoDB document client', () => {
      expect(repository['client']).toBeDefined();
    });
  });

  describe('save', () => {
    it('should save a signal score record successfully', async () => {
      mockSend.mockResolvedValue({});

      const record = {
        signalType: 'AMAZON',
        timestamp: 1234567890,
        calculatedAt: '2024-01-01T00:00:00Z',
        scores: {
          CA: 0.8,
          TX: 0.7,
        },
      };

      await repository.save(record);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            Item: record,
            ConditionExpression:
              'attribute_not_exists(#signalType) AND attribute_not_exists(#timestamp)',
            ExpressionAttributeNames: {
              '#signalType': 'signalType',
              '#timestamp': 'timestamp',
            },
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully saved signal scores record',
        expect.objectContaining({
          signalType: record.signalType,
          timestamp: record.timestamp,
        }),
      );
    });

    it('should handle ConditionalCheckFailedException gracefully', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(error);

      const record = {
        signalType: 'AMAZON',
        timestamp: 1234567890,
        calculatedAt: '2024-01-01T00:00:00Z',
        scores: {
          CA: 0.8,
          TX: 0.7,
        },
      };

      await repository.save(record);

      expect(logger.info).toHaveBeenCalledWith(
        'Signal scores record already exists, skipping duplicate',
        expect.objectContaining({
          signalType: record.signalType,
          timestamp: record.timestamp,
        }),
      );
    });

    it('should handle save errors', async () => {
      const error = new Error('Save failed');
      mockSend.mockRejectedValue(error);

      const record = {
        signalType: 'AMAZON',
        timestamp: 1234567890,
        calculatedAt: '2024-01-01T00:00:00Z',
        scores: {},
      };

      await expect(repository.save(record)).rejects.toThrow('Save failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save signal scores record',
        expect.objectContaining({
          error: 'Save failed',
          signalType: record.signalType,
          timestamp: record.timestamp,
        }),
      );
    });

    it('should handle non-Error exceptions in save', async () => {
      const error = { some: 'weird object' };
      mockSend.mockRejectedValue(error);

      const record = {
        signalType: 'AMAZON',
        timestamp: 1234567890,
        calculatedAt: '2024-01-01T00:00:00Z',
        scores: {},
      };

      await expect(repository.save(record)).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save signal scores record',
        expect.objectContaining({
          error: '[object Object]',
          signalType: record.signalType,
          timestamp: record.timestamp,
        }),
      );
    });
  });

  describe('get', () => {
    it('should retrieve a signal score record successfully', async () => {
      const mockRecord = {
        signalType: 'AMAZON',
        timestamp: 1234567890,
        calculatedAt: '2024-01-01T00:00:00Z',
        scores: {
          CA: 0.8,
          TX: 0.7,
        },
      };

      mockSend.mockResolvedValue({
        Item: mockRecord,
      });

      const result = await repository.get('AMAZON', 1234567890);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Key: {
              signalType: 'AMAZON',
              timestamp: 1234567890,
            },
          },
        }),
      );
      expect(result).toEqual(mockRecord);
    });

    it('should return null when record not found', async () => {
      mockSend.mockResolvedValue({});

      const result = await repository.get('AMAZON', 1234567890);

      expect(result).toBeNull();
    });

    it('should handle get errors', async () => {
      const error = new Error('Get failed');
      mockSend.mockRejectedValue(error);

      await expect(repository.get('AMAZON', 1234567890)).rejects.toThrow(
        'Get failed',
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get signal scores record',
        expect.objectContaining({
          error: 'Get failed',
          signalType: 'AMAZON',
          timestamp: 1234567890,
        }),
      );
    });

    it('should use current timestamp when timestamp is not provided', async () => {
      jest.useFakeTimers().setSystemTime(1751089342000);
      mockSend.mockResolvedValue({});

      await repository.get('AMAZON');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Key: {
              signalType: 'AMAZON',
              timestamp: Math.floor(Date.now() / 1000),
            },
          },
        }),
      );
      jest.useRealTimers();
    });

    it('should handle non-Error exceptions in get', async () => {
      const error = 'String error';
      mockSend.mockRejectedValue(error);

      await expect(repository.get('AMAZON', 1234567890)).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get signal scores record',
        expect.objectContaining({
          error: 'String error',
          signalType: 'AMAZON',
          timestamp: 1234567890,
        }),
      );
    });
  });

  describe('exists', () => {
    it('should return true when record exists', async () => {
      mockSend.mockResolvedValue({
        Item: { signalType: 'AMAZON', timestamp: 1234567890 },
      });

      const result = await repository.exists('AMAZON', 1234567890);

      expect(result).toBe(true);
    });

    it('should return false when record does not exist', async () => {
      mockSend.mockResolvedValue({});

      const result = await repository.exists('AMAZON', 1234567890);

      expect(result).toBe(false);
    });

    it('should handle exists errors', async () => {
      const error = new Error('Exists failed');
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('AMAZON', 1234567890)).rejects.toThrow(
        'Exists failed',
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check if signal scores record exists',
        expect.objectContaining({
          error: 'Exists failed',
          signalType: 'AMAZON',
          timestamp: 1234567890,
        }),
      );
    });

    it('should use current timestamp when timestamp is not provided', async () => {
      jest.useFakeTimers().setSystemTime(1751089342000);
      mockSend.mockResolvedValue({});

      await repository.exists('AMAZON');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Key: {
              signalType: 'AMAZON',
              timestamp: Math.floor(Date.now() / 1000),
            },
          },
        }),
      );
      jest.useRealTimers();
    });

    it('should handle non-Error exceptions in exists', async () => {
      const error = 12345;
      mockSend.mockRejectedValue(error);

      await expect(repository.exists('AMAZON', 1234567890)).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check if signal scores record exists',
        expect.objectContaining({
          error: '12345',
          signalType: 'AMAZON',
          timestamp: 1234567890,
        }),
      );
    });
  });

  describe('query', () => {
    it('should query signal score records successfully', async () => {
      const mockRecords = [
        {
          signalType: 'AMAZON',
          timestamp: 1234567890,
          calculatedAt: '2024-01-01T00:00:00Z',
          scores: { CA: 0.8 },
        },
      ];

      mockSend.mockResolvedValue({
        Items: mockRecords,
      });

      const result = await repository.query('AMAZON', 1234567890, 1234567899);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            KeyConditionExpression:
              '#signalType = :signalType AND #ts BETWEEN :start AND :end',
            ExpressionAttributeValues: {
              ':signalType': 'AMAZON',
              ':start': 1234567890,
              ':end': 1234567899,
            },
            ExpressionAttributeNames: {
              '#signalType': 'signalType',
              '#ts': 'timestamp',
            },
          }),
        }),
      );
      expect(result).toEqual(mockRecords);
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockSend.mockRejectedValue(error);

      await expect(
        repository.query('AMAZON', 1234567890, 1234567899),
      ).rejects.toThrow('Query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to query signal scores records',
        expect.objectContaining({
          error: 'Query failed',
          signalType: 'AMAZON',
          start: 1234567890,
          end: 1234567899,
        }),
      );
    });

    it('should use default values when start and end are not provided', async () => {
      jest.useFakeTimers().setSystemTime(1751089342000);
      mockSend.mockResolvedValue({ Items: [] });

      await repository.query('AMAZON');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            KeyConditionExpression:
              '#signalType = :signalType AND #ts BETWEEN :start AND :end',
            ExpressionAttributeValues: {
              ':signalType': 'AMAZON',
              ':start': 0,
              ':end': Math.floor(Date.now() / 1000),
            },
            ExpressionAttributeNames: {
              '#signalType': 'signalType',
              '#ts': 'timestamp',
            },
          }),
        }),
      );
      jest.useRealTimers();
    });

    it('should return empty array when Items is undefined', async () => {
      mockSend.mockResolvedValue({});

      const result = await repository.query('AMAZON', 1234567890, 1234567899);

      expect(result).toEqual([]);
    });

    it('should handle non-Error exceptions in query', async () => {
      const error = { some: 'weird object' };
      mockSend.mockRejectedValue(error);

      await expect(
        repository.query('AMAZON', 1234567890, 1234567899),
      ).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to query signal scores records',
        expect.objectContaining({
          error: '[object Object]',
          signalType: 'AMAZON',
          start: 1234567890,
          end: 1234567899,
        }),
      );
    });
  });

  describe('method signatures', () => {
    it('should have save method', () => {
      expect(typeof repository.save).toBe('function');
    });

    it('should have get method', () => {
      expect(typeof repository.get).toBe('function');
    });

    it('should have exists method', () => {
      expect(typeof repository.exists).toBe('function');
    });

    it('should have query method', () => {
      expect(typeof repository.query).toBe('function');
    });
  });
});
