import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CONFIG } from '../../config';

export abstract class DynamoDBBlockbusterRepository<T> {
  protected client: DynamoDBDocumentClient;
  protected tableName: string;

  constructor(tableName: string, region?: string) {
    const dynamoClient = new DynamoDBClient({
      region: region ?? CONFIG.AWS_REGION,
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = tableName;
  }

  abstract save(record: T): Promise<void>;
  abstract exists(timestamp?: number): Promise<boolean>;
  abstract get(timestamp?: number): Promise<null | T>;
}
