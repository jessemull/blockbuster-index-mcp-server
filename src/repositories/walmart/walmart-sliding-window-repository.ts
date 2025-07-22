import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import type {
  WalmartSlidingWindowAggregate,
  WalmartSlidingWindowRepository,
} from '../../types/walmart';

export class DynamoDBWalmartSlidingWindowRepository
  implements WalmartSlidingWindowRepository
{
  protected client;
  protected tableName: string;

  constructor(tableName: string, region?: string) {
    const dynamoClient = new DynamoDBClient({ region: region || 'us-west-2' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName =
      tableName || 'blockbuster-index-walmart-sliding-window-dev';
  }

  async getAggregate(
    state: string,
  ): Promise<WalmartSlidingWindowAggregate | null> {
    try {
      // Query for the most recent aggregate for the state
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            state,
            // windowStart: should be determined or queried for the latest, but interface only allows state
          },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return response.Item as WalmartSlidingWindowAggregate;
    } catch (error: unknown) {
      logger.error('Failed to get Walmart sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state,
      });
      throw error;
    }
  }

  async saveAggregate(aggregate: WalmartSlidingWindowAggregate): Promise<void> {
    try {
      const item = {
        state: aggregate.state,
        windowStart: aggregate.windowStart,
        windowEnd: aggregate.windowEnd,
        totalJobCount: aggregate.totalJobCount,
        dayCount: aggregate.dayCount,
        averageJobCount: aggregate.averageJobCount,
        lastUpdated: aggregate.lastUpdated,
      };

      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );

      logger.info('Successfully saved Walmart sliding window aggregate', {
        state: aggregate.state,
        windowStart: aggregate.windowStart,
        dayCount: aggregate.dayCount,
        averageJobCount: aggregate.averageJobCount,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        logger.info(
          'Walmart sliding window aggregate already exists, skipping duplicate',
          {
            state: aggregate.state,
            windowStart: aggregate.windowStart,
          },
        );
        return;
      }

      logger.error('Failed to save Walmart sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state: aggregate.state,
        windowStart: aggregate.windowStart,
      });
      throw error;
    }
  }

  async updateAggregate(
    state: string,
    windowStart: number,
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

        const newAggregate: WalmartSlidingWindowAggregate = {
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
            windowStart,
          },
          UpdateExpression: updateExpression.join(', '),
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      logger.info('Successfully updated Walmart sliding window aggregate', {
        state,
        windowStart,
        newDayCount,
        newAverageJobCount,
        oldDayRemoved: oldDayTimestamp !== undefined,
      });
    } catch (error: unknown) {
      logger.error('Failed to update Walmart sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state,
        windowStart,
        newDayJobCount,
        newDayTimestamp,
      });
      throw error;
    }
  }
}
