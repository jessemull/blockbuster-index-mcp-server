import { DynamoDBBlockbusterIndexRepository } from './blockbuster-index-repository';

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

describe('DynamoDBBlockbusterIndexRepository', () => {
  describe('class definition', () => {
    it('should be defined', () => {
      expect(DynamoDBBlockbusterIndexRepository).toBeDefined();
    });

    it('should extend DynamoDBBlockbusterRepository', () => {
      expect(DynamoDBBlockbusterIndexRepository.prototype).toBeInstanceOf(
        Object.getPrototypeOf(DynamoDBBlockbusterIndexRepository),
      );
    });
  });

  describe('method signatures', () => {
    it('should have save method', () => {
      expect(typeof DynamoDBBlockbusterIndexRepository.prototype.save).toBe(
        'function',
      );
    });

    it('should have get method', () => {
      expect(typeof DynamoDBBlockbusterIndexRepository.prototype.get).toBe(
        'function',
      );
    });

    it('should have query method', () => {
      expect(typeof DynamoDBBlockbusterIndexRepository.prototype.query).toBe(
        'function',
      );
    });
  });
});
