import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  DynamoDBSlidingWindowRepository,
  SlidingWindowKeyStrategy,
} from '../../repositories/generic-sliding-window-repository';
import type { WalmartSlidingWindowAggregate } from '../../types/walmart';

const walmartKeyStrategy: SlidingWindowKeyStrategy<WalmartSlidingWindowAggregate> =
  {
    getAggregateCommand: (state, tableName) =>
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: '#state = :state',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':state': state },
        ScanIndexForward: false,
        Limit: 1,
      }),
    extractAggregate: (response) => {
      if (
        typeof response === 'object' &&
        response !== null &&
        'Items' in response
      ) {
        const items = (response as { Items?: unknown[] }).Items;
        if (Array.isArray(items) && items.length > 0) {
          return items[0] as WalmartSlidingWindowAggregate;
        }
      }
      return null;
    },
  };

export class DynamoDBWalmartSlidingWindowRepository extends DynamoDBSlidingWindowRepository<WalmartSlidingWindowAggregate> {
  constructor(tableName: string, region?: string) {
    super(tableName, walmartKeyStrategy, region);
  }
}
