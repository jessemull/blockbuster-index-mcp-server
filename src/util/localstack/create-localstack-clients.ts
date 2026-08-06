import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Builds DynamoDB Document and S3 clients pointed at LocalStack.
 * Requires LOCALSTACK_ENDPOINT (e.g. http://localhost:4566).
 */
export function createLocalstackClients(): {
  documentClient: DynamoDBDocumentClient;
  s3Client: S3Client;
} {
  const endpoint = process.env.LOCALSTACK_ENDPOINT;
  const region = process.env.AWS_REGION || 'us-west-2';
  const credentials = {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  };

  const dynamoClient = new DynamoDBClient({
    credentials,
    endpoint,
    region,
  });

  const documentClient = DynamoDBDocumentClient.from(dynamoClient);

  const s3Client = new S3Client({
    credentials,
    endpoint,
    forcePathStyle: true,
    region,
  });

  return { documentClient, s3Client };
}
