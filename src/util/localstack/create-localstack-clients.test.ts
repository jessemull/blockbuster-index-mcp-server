import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createLocalstackClients } from './create-localstack-clients';

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: jest.fn() }),
  },
}));

describe('createLocalstackClients', () => {
  const originalEndpoint = process.env.LOCALSTACK_ENDPOINT;
  const originalRegion = process.env.AWS_REGION;

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.LOCALSTACK_ENDPOINT;
    } else {
      process.env.LOCALSTACK_ENDPOINT = originalEndpoint;
    }

    if (originalRegion === undefined) {
      delete process.env.AWS_REGION;
    } else {
      process.env.AWS_REGION = originalRegion;
    }

    jest.clearAllMocks();
  });

  it('should configure DynamoDB and S3 clients for LocalStack', () => {
    process.env.LOCALSTACK_ENDPOINT = 'http://localhost:4566';
    delete process.env.AWS_REGION;

    const { documentClient, s3Client } = createLocalstackClients();

    expect(DynamoDBClient).toHaveBeenCalledWith({
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      endpoint: 'http://localhost:4566',
      region: 'us-west-2',
    });
    expect(DynamoDBDocumentClient.from).toHaveBeenCalled();
    expect(S3Client).toHaveBeenCalledWith({
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      endpoint: 'http://localhost:4566',
      forcePathStyle: true,
      region: 'us-west-2',
    });
    expect(documentClient).toBeDefined();
    expect(s3Client).toBeDefined();
  });

  it('should use AWS_REGION when set', () => {
    process.env.LOCALSTACK_ENDPOINT = 'http://localhost:4566';
    process.env.AWS_REGION = 'us-east-1';

    createLocalstackClients();

    expect(DynamoDBClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });
});
