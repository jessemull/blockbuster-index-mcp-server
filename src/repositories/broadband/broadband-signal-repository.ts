import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type {
  BroadbandSignalRecord,
  StateVersionMetadata,
} from '../../types/broadband';
import { DynamoDBSignalRepository } from '../base-signal-repository';
import { States } from '../../types/states';

export class DynamoDBBroadbandSignalRepository extends DynamoDBSignalRepository<BroadbandSignalRecord> {
  async save(record: BroadbandSignalRecord): Promise<void> {
    try {
      const item = {
        state: record.state,
        timestamp: record.timestamp,
        dataVersion: record.dataVersion,
        totalCensusBlocks: record.totalCensusBlocks,
        blocksWithBroadband: record.blocksWithBroadband,
        broadbandAvailabilityPercent: record.broadbandAvailabilityPercent,
        blocksWithHighSpeed: record.blocksWithHighSpeed,
        highSpeedAvailabilityPercent: record.highSpeedAvailabilityPercent,
        blocksWithGigabit: record.blocksWithGigabit,
        gigabitAvailabilityPercent: record.gigabitAvailabilityPercent,
        technologyCounts: record.technologyCounts,
        averageDownloadSpeed: record.averageDownloadSpeed,
        medianDownloadSpeed: record.medianDownloadSpeed,
        broadbandScore: record.broadbandScore,
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

      logger.info('Successfully saved broadband signal record', {
        state: record.state,
        timestamp: record.timestamp,
        broadbandScore: record.broadbandScore,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info('Broadband record already exists, skipping duplicate', {
          state: record.state,
          timestamp: record.timestamp,
        });
        return;
      }

      logger.error('Failed to save broadband signal record', {
        error: error instanceof Error ? error.message : String(error),
        state: record.state,
        timestamp: record.timestamp,
      });
      throw error;
    }
  }

  async exists(state: string, timestamp: number): Promise<boolean> {
    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            state,
            timestamp,
          },
        }),
      );

      return !!result.Item;
    } catch (error: unknown) {
      logger.error('Failed to check if broadband signal record exists', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      throw error;
    }
  }

  async get(
    state: string,
    timestamp: number,
  ): Promise<BroadbandSignalRecord | null> {
    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            state,
            timestamp,
          },
        }),
      );

      return result.Item as BroadbandSignalRecord | null;
    } catch (error: unknown) {
      logger.error('Failed to get broadband signal record', {
        error: error instanceof Error ? error.message : String(error),
        state,
        timestamp,
      });
      throw error;
    }
  }

  async getLatestVersionForState(state: string): Promise<string | null> {
    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'state-dataVersion-index',
          KeyConditionExpression: '#state = :state',
          ExpressionAttributeNames: {
            '#state': 'state',
          },
          ExpressionAttributeValues: {
            ':state': state,
          },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );

      if (result.Items && result.Items.length > 0) {
        const latestRecord = result.Items[0] as BroadbandSignalRecord;
        return latestRecord.dataVersion || null;
      }

      return null;
    } catch (error: unknown) {
      logger.error('Failed to get latest version for state', {
        error: error instanceof Error ? error.message : String(error),
        state,
      });
      return null;
    }
  }

  async saveStateVersionMetadata(
    metadata: StateVersionMetadata,
  ): Promise<void> {
    try {
      const item = {
        state: metadata.state,
        timestamp: metadata.lastProcessed,
        dataVersion: metadata.dataVersion,
        isMetadata: true,
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

      logger.info('Successfully saved state version metadata', {
        state: metadata.state,
        dataVersion: metadata.dataVersion,
        lastProcessed: metadata.lastProcessed,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info(
          'State version metadata already exists, skipping duplicate',
          {
            state: metadata.state,
            dataVersion: metadata.dataVersion,
          },
        );
        return;
      }

      logger.error('Failed to save state version metadata', {
        error: error instanceof Error ? error.message : String(error),
        state: metadata.state,
        dataVersion: metadata.dataVersion,
      });
      throw error;
    }
  }

  async getAllScores(): Promise<Record<string, number>> {
    try {
      const scores: Record<string, number> = {};

      // Initialize all states with 0...

      const states = Object.values(States);
      states.forEach((state) => {
        scores[state] = 0;
      });

      // Scan the table to get all records for our data version...

      const dataVersion = 'Dec2021-v1';
      let lastEvaluatedKey: Record<string, unknown> | undefined;

      do {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: '#dataVersion = :dataVersion',
            ExpressionAttributeNames: {
              '#dataVersion': 'dataVersion',
            },
            ExpressionAttributeValues: {
              ':dataVersion': dataVersion,
            },
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );

        if (result.Items) {
          for (const item of result.Items) {
            const record = item as BroadbandSignalRecord;

            // Only include records with broadband scores...

            if (record.state && record.broadbandScore !== undefined) {
              scores[record.state] = record.broadbandScore;
            }
          }
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      logger.info(`Retrieved scores for ${Object.keys(scores).length} states`);
      return scores;
    } catch (error: unknown) {
      logger.error('Failed to get all broadband scores', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  async getByStateAndVersion(
    state: string,
    dataVersion: string,
  ): Promise<BroadbandSignalRecord | null> {
    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'state-dataVersion-index',
          KeyConditionExpression:
            '#state = :state AND #dataVersion = :dataVersion',
          ExpressionAttributeNames: {
            '#state': 'state',
            '#dataVersion': 'dataVersion',
          },
          ExpressionAttributeValues: {
            ':state': state,
            ':dataVersion': dataVersion,
          },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );

      return result.Items && result.Items.length > 0
        ? (result.Items[0] as BroadbandSignalRecord)
        : null;
    } catch (error: unknown) {
      logger.error(
        'Failed to get broadband signal record by state and version',
        {
          error: error instanceof Error ? error.message : String(error),
          state,
          dataVersion,
        },
      );
      return null;
    }
  }
}
