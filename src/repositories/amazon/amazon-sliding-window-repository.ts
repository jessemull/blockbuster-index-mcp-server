import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  DynamoDBSlidingWindowRepository,
  SlidingWindowKeyStrategy,
} from '../../repositories/generic-sliding-window-repository';
import type { SlidingWindowAggregate } from '../../types/amazon';

const amazonKeyStrategy: SlidingWindowKeyStrategy<SlidingWindowAggregate> = {
  getAggregateCommand: (state, tableName) =>
    new GetCommand({
      TableName: tableName,
      Key: { state, windowStart: 0 },
    }),
  extractAggregate: (response) => {
    if (
      typeof response === 'object' &&
      response !== null &&
      'Item' in response
    ) {
      return (response as { Item?: unknown }).Item
        ? ((response as { Item: SlidingWindowAggregate })
            .Item as SlidingWindowAggregate)
        : null;
    }
    return null;
  },
};

export class DynamoDBAmazonSlidingWindowRepository extends DynamoDBSlidingWindowRepository<SlidingWindowAggregate> {
  constructor(tableName: string, region?: string) {
    super(tableName, amazonKeyStrategy, region);
  }
}
