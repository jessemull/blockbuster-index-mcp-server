import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import { DynamoDBSignalRepository } from '../base-signal-repository';

export class DynamoDBJobRepository<
  T extends { state: string; timestamp: number; jobCount: number },
> extends DynamoDBSignalRepository<T> {
  constructor(tableName: string, region?: string) {
    super(tableName, region);
  }

  async save(record: T): Promise<void> {
    try {
      const item = {
        jobCount: record.jobCount,
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

      logger.info('Successfully saved job record', {
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

      logger.error('Failed to save job record', {
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
      logger.error('Failed to check if job record exists', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      throw error;
    }
  }

  async get(state: string, timestamp?: number): Promise<T | null> {
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
        jobCount: response.Item.jobCount as number,
        state: response.Item.state as string,
        timestamp: response.Item.timestamp as number,
      } as T;
    } catch (error: unknown) {
      logger.error('Failed to get job record', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      throw error;
    }
  }

  async query(state: string, start?: number, end?: number): Promise<T[]> {
    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression:
            '#state = :state AND #ts BETWEEN :start AND :end',
          ExpressionAttributeValues: {
            ':state': state,
            ':start': start || 0,
            ':end': end || Math.floor(Date.now() / 1000),
          },
          ExpressionAttributeNames: {
            '#state': 'state',
            '#ts': 'timestamp',
          },
        }),
      );

      return (response.Items || []).map((item: Record<string, unknown>) => ({
        jobCount: item.jobCount as number,
        state: item.state as string,
        timestamp: item.timestamp as number,
      })) as T[];
    } catch (error: unknown) {
      logger.error('Failed to query job records', {
        end,
        error: error instanceof Error ? error.message : String(error),
        start,
        state,
      });
      throw error;
    }
  }
}
