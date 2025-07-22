import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';
import { DynamoDBSignalRepository } from '../base-signal-repository';

export interface SlidingWindowKeyStrategy<TAggregate> {
  getAggregateCommand(
    state: string,
    tableName: string,
  ): GetCommand | QueryCommand;
  extractAggregate(response: unknown): TAggregate | null;
}

export class DynamoDBSlidingWindowRepository<
  TAggregate extends {
    state: string;
    windowStart: number;
    totalJobCount: number;
    dayCount: number;
    averageJobCount: number;
    windowEnd: number;
    lastUpdated: number;
  },
> extends DynamoDBSignalRepository<TAggregate> {
  private keyStrategy: SlidingWindowKeyStrategy<TAggregate>;

  constructor(
    tableName: string,
    keyStrategy: SlidingWindowKeyStrategy<TAggregate>,
    region?: string,
  ) {
    super(tableName, region);
    this.keyStrategy = keyStrategy;
  }

  async getAggregate(state: string): Promise<TAggregate | null> {
    try {
      const command = this.keyStrategy.getAggregateCommand(
        state,
        this.tableName,
      );
      // TypeScript workaround: cast to unknown then to expected type
      const response = await this.client.send(
        command as unknown as Parameters<typeof this.client.send>[0],
      );
      return this.keyStrategy.extractAggregate(response);
    } catch (error: unknown) {
      logger.error('Failed to get sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state,
      });
      throw error;
    }
  }

  async saveAggregate(aggregate: TAggregate): Promise<void> {
    try {
      const item = { ...aggregate };
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );
      logger.info('Successfully saved sliding window aggregate', {
        state: aggregate.state,
        windowStart: aggregate.windowStart,
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
            windowStart: aggregate.windowStart,
          },
        );
        return;
      }
      logger.error('Failed to save sliding window aggregate', {
        error: error instanceof Error ? error.message : String(error),
        state: aggregate.state,
        windowStart: aggregate.windowStart,
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
        const newAggregate = {
          state,
          windowStart: newDayTimestamp,
          windowEnd: newDayTimestamp,
          totalJobCount: newDayJobCount,
          dayCount: 1,
          averageJobCount: newDayJobCount,
          lastUpdated: now,
        } as TAggregate;
        await this.saveAggregate(newAggregate);
        return;
      }
      let newTotalJobCount = currentAggregate.totalJobCount + newDayJobCount;
      let newDayCount = currentAggregate.dayCount + 1;
      let newWindowStart = currentAggregate.windowStart;
      let newWindowEnd = newDayTimestamp;
      if (oldDayTimestamp !== undefined && oldDayJobCount !== undefined) {
        newTotalJobCount -= oldDayJobCount;
        newDayCount -= 1;
        newWindowStart = oldDayTimestamp + 86400000;
      }
      newDayCount = Math.max(1, newDayCount);
      const newAverageJobCount = newTotalJobCount / newDayCount;
      const updateExpression = [
        'SET #windowEnd = :windowEnd',
        '#totalJobCount = :totalJobCount',
        '#dayCount = :dayCount',
        '#averageJobCount = :averageJobCount',
        '#lastUpdated = :lastUpdated',
      ];
      if (oldDayTimestamp !== undefined && oldDayJobCount !== undefined) {
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
      if (oldDayTimestamp !== undefined && oldDayJobCount !== undefined) {
        expressionAttributeNames['#windowStart'] = 'windowStart';
        expressionAttributeValues[':windowStart'] = newWindowStart;
      }
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            state,
            windowStart: currentAggregate.windowStart,
          },
          UpdateExpression: updateExpression.join(', '),
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );
      logger.info('Successfully updated sliding window aggregate', {
        state,
        windowStart: currentAggregate.windowStart,
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

  // Implement abstract methods from base class as thin wrappers
  async save(record: TAggregate): Promise<void> {
    return this.saveAggregate(record);
  }
  async exists(state: string): Promise<boolean> {
    const aggregate = await this.getAggregate(state);
    return aggregate !== null;
  }
  async get(state: string): Promise<TAggregate | null> {
    return this.getAggregate(state);
  }
}
