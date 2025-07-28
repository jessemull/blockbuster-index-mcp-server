import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type {
  BlsProcessedFile,
  BlsStateData,
  BlsSignalRecord,
  BlsRepository,
} from '../../types/bls';

export class DynamoDBBlsRepository implements BlsRepository {
  private processedFilesTableName: string;
  private stateDataTableName: string;
  private signalsTableName: string;

  constructor(
    processedFilesTableName: string,
    stateDataTableName: string,
    signalsTableName: string,
  ) {
    this.processedFilesTableName = processedFilesTableName;
    this.stateDataTableName = stateDataTableName;
    this.signalsTableName = signalsTableName;
  }

  async saveProcessedFile(file: BlsProcessedFile): Promise<void> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      await client.send(
        new PutCommand({
          Item: {
            year: file.year,
            processedAt: file.processedAt,
            fileSize: file.fileSize,
            recordCount: file.recordCount,
          },
          TableName: this.processedFilesTableName,
          ConditionExpression: 'attribute_not_exists(#year)',
          ExpressionAttributeNames: {
            '#year': 'year',
          },
        }),
      );

      logger.info('Successfully saved processed file record', {
        year: file.year,
        processedAt: file.processedAt,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info('File already processed, skipping duplicate', {
          year: file.year,
        });
        return;
      }

      logger.error('Failed to save processed file record', {
        error: error instanceof Error ? error.message : String(error),
        year: file.year,
      });
      throw error;
    }
  }

  async isFileProcessed(year: string): Promise<boolean> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      const response = await client.send(
        new GetCommand({
          TableName: this.processedFilesTableName,
          Key: {
            year,
          },
        }),
      );

      return !!response.Item;
    } catch (error: unknown) {
      logger.error('Failed to check if file is processed', {
        error: error instanceof Error ? error.message : String(error),
        year,
      });
      throw error;
    }
  }

  async saveStateData(data: BlsStateData): Promise<void> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      await client.send(
        new PutCommand({
          Item: {
            state_year: `${data.state}_${data.year}`,
            state: data.state,
            year: data.year,
            retailLq: data.retailLq,
            timestamp: data.timestamp,
          },
          TableName: this.stateDataTableName,
          ConditionExpression: 'attribute_not_exists(#state_year)',
          ExpressionAttributeNames: {
            '#state_year': 'state_year',
          },
        }),
      );

      logger.info('Successfully saved state data', {
        state: data.state,
        year: data.year,
        retailLq: data.retailLq,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info('State data already exists, skipping duplicate', {
          state: data.state,
          year: data.year,
        });
        return;
      }

      logger.error('Failed to save state data', {
        error: error instanceof Error ? error.message : String(error),
        state: data.state,
        year: data.year,
      });
      throw error;
    }
  }

  async getStateData(
    state: string,
    year: number,
  ): Promise<BlsStateData | null> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      const response = await client.send(
        new GetCommand({
          TableName: this.stateDataTableName,
          Key: {
            state_year: `${state}_${year}`,
          },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return {
        state: response.Item.state as string,
        year: response.Item.year as number,
        retailLq: response.Item.retailLq as number,
        timestamp: response.Item.timestamp as number,
      };
    } catch (error: unknown) {
      logger.error('Failed to get state data', {
        error: error instanceof Error ? error.message : String(error),
        state,
        year,
      });
      throw error;
    }
  }

  async getAllStateDataForYear(year: number): Promise<BlsStateData[]> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      const allItems: BlsStateData[] = [];
      let lastEvaluatedKey: Record<string, unknown> | undefined;

      do {
        const response = await client.send(
          new ScanCommand({
            TableName: this.stateDataTableName,
            FilterExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year',
            },
            ExpressionAttributeValues: {
              ':year': year,
            },
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );

        if (response.Items) {
          const items = response.Items.map((item) => ({
            state: item.state as string,
            year: item.year as number,
            retailLq: item.retailLq as number,
            timestamp: item.timestamp as number,
          }));
          allItems.push(...items);
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return allItems;
    } catch (error: unknown) {
      logger.error('Failed to get all state data for year', {
        error: error instanceof Error ? error.message : String(error),
        year,
      });
      throw error;
    }
  }

  async saveSignal(record: BlsSignalRecord): Promise<void> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      await client.send(
        new PutCommand({
          Item: {
            state_fips: record.state,
            timestamp: record.timestamp,
            calculatedAt: record.calculatedAt,
            retailLqSlope: record.retailLqSlope,
            retailLqTrend: record.retailLqTrend,
            blockbusterScore: record.blockbusterScore,
            dataPoints: record.dataPoints,
            yearsAnalyzed: record.yearsAnalyzed,
          },
          TableName: this.signalsTableName,
          ConditionExpression:
            'attribute_not_exists(#state_fips) AND attribute_not_exists(#timestamp)',
          ExpressionAttributeNames: {
            '#state_fips': 'state_fips',
            '#timestamp': 'timestamp',
          },
        }),
      );

      logger.info('Successfully saved BLS signal record', {
        state: record.state,
        timestamp: record.timestamp,
        blockbusterScore: record.blockbusterScore,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info('Signal record already exists, skipping duplicate', {
          state: record.state,
          timestamp: record.timestamp,
        });
        return;
      }

      logger.error('Failed to save BLS signal record', {
        error: error instanceof Error ? error.message : String(error),
        state: record.state,
        timestamp: record.timestamp,
      });
      throw error;
    }
  }

  async getLatestSignal(state: string): Promise<BlsSignalRecord | null> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      const response = await client.send(
        new QueryCommand({
          TableName: this.signalsTableName,
          KeyConditionExpression: '#state_fips = :state_fips',
          ExpressionAttributeNames: {
            '#state_fips': 'state_fips',
          },
          ExpressionAttributeValues: {
            ':state_fips': state,
          },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );

      if (!response.Items || response.Items.length === 0) {
        return null;
      }

      const item = response.Items[0];
      return {
        state: item.state_fips as string,
        timestamp: item.timestamp as number,
        calculatedAt: item.calculatedAt as string,
        retailLqSlope: item.retailLqSlope as number,
        retailLqTrend: item.retailLqTrend as 'declining' | 'stable' | 'growing',
        blockbusterScore: item.blockbusterScore as number,
        dataPoints: item.dataPoints as number,
        yearsAnalyzed: item.yearsAnalyzed as number[],
      };
    } catch (error: unknown) {
      logger.error('Failed to get latest signal', {
        error: error instanceof Error ? error.message : String(error),
        state,
      });
      throw error;
    }
  }

  async getAllSignals(): Promise<BlsSignalRecord[]> {
    try {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });

      const allItems: BlsSignalRecord[] = [];
      let lastEvaluatedKey: Record<string, unknown> | undefined;

      do {
        const response = await client.send(
          new ScanCommand({
            TableName: this.signalsTableName,
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );

        if (response.Items) {
          const items = response.Items.map((item) => ({
            state: item.state_fips as string,
            timestamp: item.timestamp as number,
            calculatedAt: item.calculatedAt as string,
            retailLqSlope: item.retailLqSlope as number,
            retailLqTrend: item.retailLqTrend as
              | 'declining'
              | 'stable'
              | 'growing',
            blockbusterScore: item.blockbusterScore as number,
            dataPoints: item.dataPoints as number,
            yearsAnalyzed: item.yearsAnalyzed as number[],
          }));
          allItems.push(...items);
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return allItems;
    } catch (error: unknown) {
      logger.error('Failed to get all signals', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
