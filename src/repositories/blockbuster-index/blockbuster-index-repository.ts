import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type { BlockbusterIndexRecord } from '../../types/response';
import type { StateScore } from '../../types/states';
import { DynamoDBBlockbusterRepository } from './base-blockbuster-repository';

export class DynamoDBBlockbusterIndexRepository extends DynamoDBBlockbusterRepository<BlockbusterIndexRecord> {
  async save(record: BlockbusterIndexRecord): Promise<void> {
    try {
      const item = {
        timestamp: record.timestamp,
        calculatedAt: record.calculatedAt,
        version: record.version,
        totalStates: record.totalStates,
        states: record.states,
        signalStatus: record.signalStatus,
      };

      await this.client.send(
        new PutCommand({
          Item: item,
          TableName: this.tableName,
          ConditionExpression: 'attribute_not_exists(#timestamp)',
          ExpressionAttributeNames: {
            '#timestamp': 'timestamp',
          },
        }),
      );

      logger.info('Successfully saved blockbuster index record', {
        timestamp: record.timestamp,
        version: record.version,
        totalStates: record.totalStates,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info(
          'Blockbuster index record already exists, skipping duplicate',
          {
            timestamp: record.timestamp,
          },
        );
        return;
      }

      logger.error('Failed to save blockbuster index record', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: record.timestamp,
      });
      throw error;
    }
  }

  async exists(timestamp?: number): Promise<boolean> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            timestamp: timestamp || Math.floor(Date.now() / 1000),
          },
        }),
      );

      return !!response.Item;
    } catch (error: unknown) {
      logger.error('Failed to check if blockbuster index record exists', {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  async get(timestamp?: number): Promise<BlockbusterIndexRecord | null> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            timestamp: timestamp || Math.floor(Date.now() / 1000),
          },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return {
        timestamp: response.Item.timestamp as number,
        calculatedAt: response.Item.calculatedAt as string,
        version: response.Item.version as string,
        totalStates: response.Item.totalStates as number,
        states: response.Item.states as Record<string, StateScore>,
        signalStatus: response.Item.signalStatus as {
          total: number;
          successful: number;
          failed: number;
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to get blockbuster index record', {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  async query(start?: number, end?: number): Promise<BlockbusterIndexRecord[]> {
    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: '#ts BETWEEN :start AND :end',
          ExpressionAttributeValues: {
            ':start': start || 0,
            ':end': end || Math.floor(Date.now() / 1000),
          },
          ExpressionAttributeNames: {
            '#ts': 'timestamp',
          },
        }),
      );

      return (response.Items || []).map((item: Record<string, unknown>) => ({
        timestamp: item.timestamp as number,
        calculatedAt: item.calculatedAt as string,
        version: item.version as string,
        totalStates: item.totalStates as number,
        states: item.states as Record<string, StateScore>,
        signalStatus: item.signalStatus as {
          total: number;
          successful: number;
          failed: number;
        },
      }));
    } catch (error: unknown) {
      logger.error('Failed to query blockbuster index records', {
        end,
        error: error instanceof Error ? error.message : String(error),
        start,
      });
      throw error;
    }
  }
}
