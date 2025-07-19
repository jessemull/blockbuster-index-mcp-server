import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type { SignalScoreRecord } from '../../types';
import { DynamoDBSignalRepository } from '../base-signal-repository';

export class DynamoDBSignalScoresRepository extends DynamoDBSignalRepository<SignalScoreRecord> {
  async save(record: SignalScoreRecord): Promise<void> {
    try {
      const item = {
        signalType: record.signalType,
        timestamp: record.timestamp,
        calculatedAt: record.calculatedAt,
        scores: record.scores,
      };

      await this.client.send(
        new PutCommand({
          Item: item,
          TableName: this.tableName,
          ConditionExpression:
            'attribute_not_exists(#signalType) AND attribute_not_exists(#timestamp)',
          ExpressionAttributeNames: {
            '#signalType': 'signalType',
            '#timestamp': 'timestamp',
          },
        }),
      );

      logger.info('Successfully saved signal scores record', {
        signalType: record.signalType,
        timestamp: record.timestamp,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info('Signal scores record already exists, skipping duplicate', {
          signalType: record.signalType,
          timestamp: record.timestamp,
        });
        return;
      }

      logger.error('Failed to save signal scores record', {
        error: error instanceof Error ? error.message : String(error),
        signalType: record.signalType,
        timestamp: record.timestamp,
      });
      throw error;
    }
  }

  async exists(signalType: string, timestamp?: number): Promise<boolean> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            signalType: signalType,
            timestamp: timestamp || Math.floor(Date.now() / 1000),
          },
        }),
      );

      return !!response.Item;
    } catch (error: unknown) {
      logger.error('Failed to check if signal scores record exists', {
        error: error instanceof Error ? error.message : String(error),
        signalType,
        timestamp,
      });
      throw error;
    }
  }

  async get(
    signalType: string,
    timestamp?: number,
  ): Promise<SignalScoreRecord | null> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            signalType: signalType,
            timestamp: timestamp || Math.floor(Date.now() / 1000),
          },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return {
        signalType: response.Item.signalType as string,
        timestamp: response.Item.timestamp as number,
        calculatedAt: response.Item.calculatedAt as string,
        scores: response.Item.scores as Record<string, number>,
      };
    } catch (error: unknown) {
      logger.error('Failed to get signal scores record', {
        error: error instanceof Error ? error.message : String(error),
        signalType,
        timestamp,
      });
      throw error;
    }
  }

  async query(
    signalType: string,
    start?: number,
    end?: number,
  ): Promise<SignalScoreRecord[]> {
    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression:
            '#signalType = :signalType AND #ts BETWEEN :start AND :end',
          ExpressionAttributeValues: {
            ':signalType': signalType,
            ':start': start || 0,
            ':end': end || Math.floor(Date.now() / 1000),
          },
          ExpressionAttributeNames: {
            '#signalType': 'signalType',
            '#ts': 'timestamp',
          },
        }),
      );

      return (response.Items || []).map((item: Record<string, unknown>) => ({
        signalType: item.signalType as string,
        timestamp: item.timestamp as number,
        calculatedAt: item.calculatedAt as string,
        scores: item.scores as Record<string, number>,
      }));
    } catch (error: unknown) {
      logger.error('Failed to query signal scores records', {
        end,
        error: error instanceof Error ? error.message : String(error),
        start,
        signalType,
      });
      throw error;
    }
  }
}
