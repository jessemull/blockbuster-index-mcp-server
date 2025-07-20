import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type {
  CensusSignalRecord,
  CensusSignalRepository,
} from '../../types/census';
import { DynamoDBSignalRepository } from '../base-signal-repository';

export class DynamoDBCensusSignalRepository
  extends DynamoDBSignalRepository<CensusSignalRecord>
  implements CensusSignalRepository
{
  async save(record: CensusSignalRecord): Promise<void> {
    try {
      const item = {
        retailStores: record.retailStores,
        workforce: record.workforce,
        state: record.state,
        timestamp: record.timestamp,
      };

      await this.client.send(
        new PutCommand({
          Item: item,
          TableName: this.tableName,
          ConditionExpression:
            'attribute_not_exists(#state) AND attribute_not_exists(#timestamp)',
          ExpressionAttributeNames: {
            '#state': 'state',
            '#timestamp': 'timestamp',
          },
        }),
      );

      logger.info('Successfully saved census signal record', {
        state: record.state,
        timestamp: record.timestamp,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info('Record already exists, skipping duplicate', {
          state: record.state,
          timestamp: record.timestamp,
        });
        return;
      }

      logger.error('Failed to save census signal record', {
        error: error instanceof Error ? error.message : String(error),
        state: record.state,
        timestamp: record.timestamp,
      });
      throw error;
    }
  }

  async exists(state: string, timestamp?: number): Promise<boolean> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            state: state,
            timestamp: timestamp || Math.floor(Date.now() / 1000),
          },
        }),
      );

      return !!response.Item;
    } catch (error: unknown) {
      logger.error('Failed to check if census record exists', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      throw error;
    }
  }

  async get(
    state: string,
    timestamp?: number,
  ): Promise<CensusSignalRecord | null> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            state: state,
            timestamp: timestamp || Math.floor(Date.now() / 1000),
          },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return {
        retailStores: response.Item.retailStores as number,
        workforce: response.Item.workforce as number,
        state: response.Item.state as string,
        timestamp: response.Item.timestamp as number,
      };
    } catch (error: unknown) {
      logger.error('Failed to get census signal record', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      throw error;
    }
  }

  async getLatest(state: string): Promise<CensusSignalRecord | null> {
    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: '#state = :state',
          ExpressionAttributeNames: {
            '#state': 'state',
          },
          ExpressionAttributeValues: {
            ':state': state,
          },
          ScanIndexForward: false, // Get most recent first
          Limit: 1, // Only get the latest record
        }),
      );

      if (!response.Items || response.Items.length === 0) {
        return null;
      }

      const item = response.Items[0];
      return {
        retailStores: item.retailStores as number,
        workforce: item.workforce as number,
        state: item.state as string,
        timestamp: item.timestamp as number,
      };
    } catch (error: unknown) {
      logger.error('Failed to get latest census signal record', {
        error: error instanceof Error ? error.message : String(error),
        state,
      });
      throw error;
    }
  }
}
