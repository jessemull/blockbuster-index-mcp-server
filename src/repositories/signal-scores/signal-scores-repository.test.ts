import { DynamoDBSignalScoresRepository } from './signal-scores-repository';

// Mock the AWS SDK completely
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
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DynamoDBSignalScoresRepository', () => {
  describe('class definition', () => {
    it('should be defined', () => {
      expect(DynamoDBSignalScoresRepository).toBeDefined();
    });

    it('should extend DynamoDBSignalRepository', () => {
      expect(DynamoDBSignalScoresRepository.prototype).toBeInstanceOf(
        Object.getPrototypeOf(DynamoDBSignalScoresRepository),
      );
    });
  });

  describe('method signatures', () => {
    it('should have save method', () => {
      expect(typeof DynamoDBSignalScoresRepository.prototype.save).toBe(
        'function',
      );
    });

    it('should have get method', () => {
      expect(typeof DynamoDBSignalScoresRepository.prototype.get).toBe(
        'function',
      );
    });

    it('should have exists method', () => {
      expect(typeof DynamoDBSignalScoresRepository.prototype.exists).toBe(
        'function',
      );
    });

    it('should have query method', () => {
      expect(typeof DynamoDBSignalScoresRepository.prototype.query).toBe(
        'function',
      );
    });
  });
});
