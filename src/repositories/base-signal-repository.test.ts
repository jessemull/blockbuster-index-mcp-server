import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBSignalRepository } from './base-signal-repository';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

(DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
  send: jest.fn(),
});

class TestSignalRepository extends DynamoDBSignalRepository<{
  state: string;
}> {
  async save(): Promise<void> {
    return;
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async get(): Promise<{ state: string } | null> {
    return null;
  }
}

describe('DynamoDBSignalRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a DynamoDB client with the default region when none is provided', () => {
    new TestSignalRepository('test-table');

    expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'us-west-2' });
    expect(DynamoDBDocumentClient.from).toHaveBeenCalled();
  });

  it('should create a DynamoDB client with a custom region when provided', () => {
    new TestSignalRepository('test-table', 'eu-west-1');

    expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'eu-west-1' });
  });
});
