import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export abstract class DynamoDBBlockbusterRepository<T> {
  protected client: DynamoDBDocumentClient;
  protected tableName: string;

  constructor(tableName: string, region?: string) {
    const dynamoClient = new DynamoDBClient({ region: region || 'us-west-2' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = tableName;
  }

  abstract save(record: T): Promise<void>;
  abstract exists(timestamp?: number): Promise<boolean>;
  abstract get(timestamp?: number): Promise<T | null>;
}
