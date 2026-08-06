import type { S3Client } from '@aws-sdk/client-s3';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createLocalstackClients } from './create-localstack-clients';

const runDescribe = process.env.LOCALSTACK_ENDPOINT ? describe : describe.skip;

runDescribe('LocalStack DynamoDB + S3', () => {
  const suffix = Date.now();
  const tableName = `bb-localstack-signal-scores-${suffix}`;
  const bucketName = `bb-localstack-scores-${suffix}`;
  const objectKey = `scores/test-${suffix}.json`;

  let documentClient: DynamoDBDocumentClient;
  let s3Client: S3Client;

  beforeAll(async () => {
    ({ documentClient, s3Client } = createLocalstackClients());

    await documentClient.send(
      new CreateTableCommand({
        AttributeDefinitions: [
          { AttributeName: 'signalType', AttributeType: 'S' },
          { AttributeName: 'timestamp', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'signalType', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        TableName: tableName,
      }),
    );

    // Wait until the table is active before writes

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const description = await documentClient.send(
        new DescribeTableCommand({ TableName: tableName }),
      );

      if (description.Table?.TableStatus === 'ACTIVE') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
  }, 60_000);

  afterAll(async () => {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }),
      );
    } catch {
      // best-effort cleanup
    }

    try {
      await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    } catch {
      // best-effort cleanup
    }

    try {
      await documentClient.send(
        new DeleteTableCommand({ TableName: tableName }),
      );
    } catch {
      // best-effort cleanup
    }
  }, 60_000);

  it('should put and get a signal scores item', async () => {
    const item = {
      calculatedAt: '2024-01-01T00:00:00Z',
      scores: { CA: 0.8, TX: 0.7 },
      signalType: 'AMAZON',
      timestamp: 1_234_567_890,
    };

    await documentClient.send(
      new PutCommand({
        Item: item,
        TableName: tableName,
      }),
    );

    const response = await documentClient.send(
      new GetCommand({
        Key: {
          signalType: item.signalType,
          timestamp: item.timestamp,
        },
        TableName: tableName,
      }),
    );

    expect(response.Item).toBeDefined();
    expect(response.Item?.signalType).toBe(item.signalType);
    expect(response.Item?.timestamp).toBe(item.timestamp);
    expect(response.Item?.calculatedAt).toBe(item.calculatedAt);
    expect(response.Item?.scores).toEqual(item.scores);
    expect(typeof (response.Item?.scores as Record<string, number>).CA).toBe(
      'number',
    );
  });

  it('should put and get a JSON object from S3', async () => {
    const payload = { CA: 0.8, TX: 0.7 };
    const body = JSON.stringify(payload);

    await s3Client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: bucketName,
        ContentType: 'application/json',
        Key: objectKey,
      }),
    );

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }),
    );

    const retrieved = await response.Body?.transformToString();

    expect(retrieved).toBe(body);
    expect(JSON.parse(retrieved ?? '')).toEqual(payload);
  });
});
