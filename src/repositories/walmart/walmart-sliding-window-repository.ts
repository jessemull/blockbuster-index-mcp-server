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
    extractAggregate: (response) =>
      response.Items && response.Items.length > 0
        ? (response.Items[0] as WalmartSlidingWindowAggregate)
        : null,
  };

export class DynamoDBWalmartSlidingWindowRepository extends DynamoDBSlidingWindowRepository<WalmartSlidingWindowAggregate> {
  constructor(tableName: string, region?: string) {
    super(tableName, walmartKeyStrategy, region);
  }
}
