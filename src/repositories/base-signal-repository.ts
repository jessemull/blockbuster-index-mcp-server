import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SignalRepository } from '../types/amazon';

export abstract class DynamoDBSignalRepository<T>
  implements SignalRepository<T>
{
  protected client: DynamoDBDocumentClient;
  protected tableName: string;

  constructor(tableName: string, region?: string) {
    const dynamoClient = new DynamoDBClient({ region: region || 'us-west-2' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = tableName;
  }

  abstract save(record: T): Promise<void>;
  abstract exists(state: string, timestamp?: number): Promise<boolean>;
}
