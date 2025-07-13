import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../util';
import type { BroadbandSignalRecord } from '../types/broadband';
import { DynamoDBSignalRepository } from './base-signal-repository';

export class DynamoDBBroadbandSignalRepository extends DynamoDBSignalRepository<BroadbandSignalRecord> {
  async save(record: BroadbandSignalRecord): Promise<void> {
    try {
      const item = {
        state: record.state,
        timestamp: record.timestamp,
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
}
