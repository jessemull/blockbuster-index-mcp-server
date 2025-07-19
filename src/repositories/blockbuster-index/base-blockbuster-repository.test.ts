import { DynamoDBBlockbusterRepository } from './base-blockbuster-repository';

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
}));

// Create a concrete implementation for testing
class TestBlockbusterRepository extends DynamoDBBlockbusterRepository<{
  id: string;
}> {
  async save(): Promise<void> {
    // Implementation not needed for this test
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async get(): Promise<{ id: string } | null> {
    return null;
  }
}

describe('DynamoDBBlockbusterRepository', () => {
  let repository: TestBlockbusterRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TestBlockbusterRepository('test-table');
  });

  describe('constructor', () => {
    it('should create repository with correct table name', () => {
      expect(repository).toBeInstanceOf(DynamoDBBlockbusterRepository);
      expect(repository['tableName']).toBe('test-table');
    });
  });

  describe('client', () => {
    it('should have DynamoDB document client', () => {
      expect(repository['client']).toBeDefined();
    });
  });
});
