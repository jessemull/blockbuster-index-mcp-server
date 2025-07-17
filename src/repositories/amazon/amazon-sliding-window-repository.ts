import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type {
  SlidingWindowAggregate,
  SlidingWindowRepository,
} from '../../types/amazon';
import { DynamoDBSignalRepository } from '../base-signal-repository';

export class DynamoDBAmazonSlidingWindowRepository
  extends DynamoDBSignalRepository<SlidingWindowAggregate>
  implements SlidingWindowRepository
{
  async getAggregate(state: string): Promise<SlidingWindowAggregate | null> {
    try {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            state,
            windowStart: 0,
          },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return response.Item as SlidingWindowAggregate;
    } catch (error: unknown) {
      logger.error('Failed to get sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state,
      });
      throw error;
    }
  }

  async saveAggregate(aggregate: SlidingWindowAggregate): Promise<void> {
    try {
      const item = {
        state: aggregate.state,
        windowStart: 0,
        windowEnd: aggregate.windowEnd,
        totalJobCount: aggregate.totalJobCount,
        dayCount: aggregate.dayCount,
        averageJobCount: aggregate.averageJobCount,
        lastUpdated: aggregate.lastUpdated,
      };

      await this.client.send(
        new PutCommand({
          Item: item,
          TableName: this.tableName,
          ConditionExpression:
            'attribute_not_exists(#state) AND attribute_not_exists(#windowStart)',
          ExpressionAttributeNames: {
            '#state': 'state',
            '#windowStart': 'windowStart',
          },
        }),
      );

      logger.info('Successfully saved sliding window aggregate', {
        state: aggregate.state,
        dayCount: aggregate.dayCount,
        averageJobCount: aggregate.averageJobCount,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info(
          'Sliding window aggregate already exists, skipping duplicate',
          {
            state: aggregate.state,
          },
        );
        return;
      }

      logger.error('Failed to save sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state: aggregate.state,
      });
      throw error;
    }
  }

  async updateAggregate(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
    oldDayTimestamp?: number,
    oldDayJobCount?: number,
  ): Promise<void> {
    try {
      const currentAggregate = await this.getAggregate(state);
      const now = Date.now();

      if (!currentAggregate) {
        // First time creating aggregate...

        const newAggregate: SlidingWindowAggregate = {
          state,
          windowStart: newDayTimestamp,
          windowEnd: newDayTimestamp,
          totalJobCount: newDayJobCount,
          dayCount: 1,
          averageJobCount: newDayJobCount,
          lastUpdated: now,
        };

        await this.saveAggregate(newAggregate);
        return;
      }

      // Update existing aggregate...

      let newTotalJobCount = currentAggregate.totalJobCount + newDayJobCount;
      let newDayCount = currentAggregate.dayCount + 1;
      let newWindowStart = currentAggregate.windowStart;
      let newWindowEnd = newDayTimestamp;

      // If we have an old day to remove (sliding window)...

      if (oldDayTimestamp && oldDayJobCount !== undefined) {
        newTotalJobCount -= oldDayJobCount;
        newDayCount -= 1;
        newWindowStart = oldDayTimestamp + 86400000; // Add one day to start.
      }

      // Ensure we dont go below 1...

      newDayCount = Math.max(1, newDayCount);
      const newAverageJobCount = newTotalJobCount / newDayCount;

      const updateExpression = [
        'SET #windowEnd = :windowEnd',
        '#totalJobCount = :totalJobCount',
        '#dayCount = :dayCount',
        '#averageJobCount = :averageJobCount',
        '#lastUpdated = :lastUpdated',
      ];

      if (oldDayTimestamp && oldDayJobCount !== undefined) {
        updateExpression.push('#windowStart = :windowStart');
      }

      const expressionAttributeNames: Record<string, string> = {
        '#windowEnd': 'windowEnd',
        '#totalJobCount': 'totalJobCount',
        '#dayCount': 'dayCount',
        '#averageJobCount': 'averageJobCount',
        '#lastUpdated': 'lastUpdated',
      };

      const expressionAttributeValues: Record<string, unknown> = {
        ':windowEnd': newWindowEnd,
        ':totalJobCount': newTotalJobCount,
        ':dayCount': newDayCount,
        ':averageJobCount': newAverageJobCount,
        ':lastUpdated': now,
      };

      if (oldDayTimestamp && oldDayJobCount !== undefined) {
        expressionAttributeNames['#windowStart'] = 'windowStart';
        expressionAttributeValues[':windowStart'] = newWindowStart;
      }

      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            state,
            windowStart: 0,
          },
          UpdateExpression: updateExpression.join(', '),
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      logger.info('Successfully updated sliding window aggregate', {
        state,
        newDayCount,
        newAverageJobCount,
        oldDayRemoved: oldDayTimestamp !== undefined,
      });
    } catch (error: unknown) {
      logger.error('Failed to update sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state,
        newDayJobCount,
        newDayTimestamp,
      });
      throw error;
    }
  }

  // Required by base class but not used for sliding window...

  async save(record: SlidingWindowAggregate): Promise<void> {
    await this.saveAggregate(record);
  }

  async exists(state: string): Promise<boolean> {
    const aggregate = await this.getAggregate(state);
    return aggregate !== null;
  }
}
