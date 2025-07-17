import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type { CensusSignalRecord } from '../../types/census';
import { DynamoDBSignalRepository } from '../base-signal-repository';

export class DynamoDBCensusSignalRepository extends DynamoDBSignalRepository<CensusSignalRecord> {
  async save(record: CensusSignalRecord): Promise<void> {
    try {
      const item = {
        retailStores: record.retailStores,
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
}
