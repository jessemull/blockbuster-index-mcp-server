jest.mock('@aws-sdk/lib-dynamodb', () => {
  class MockQueryCommand {
    public input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  return { QueryCommand: MockQueryCommand };
});

jest.mock('../../repositories/generic-sliding-window-repository', () => {
  class MockSlidingWindowRepository {
    public _tableName: string;
    public _strategy: any;
    public _region?: string;

    constructor(tableName: string, strategy: any, region?: string) {
      this._tableName = tableName;
      this._strategy = strategy;
      this._region = region;
    }
  }

  return {
    DynamoDBSlidingWindowRepository: MockSlidingWindowRepository,
    SlidingWindowKeyStrategy: undefined,
  };
});

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBWalmartSlidingWindowRepository } from './walmart-sliding-window-repository';

describe('DynamoDBWalmartSlidingWindowRepository and strategy', () => {
  const TABLE = 'TestTable';
  const REGION = 'us-east-1';

  test('constructor passes tableName, strategy, and region to super', () => {
    const repo = new DynamoDBWalmartSlidingWindowRepository(
      TABLE,
      REGION,
    ) as any;

    expect(repo._tableName).toBe(TABLE);
    expect(repo._region).toBe(REGION);

    expect(repo._strategy).toBeDefined();
    expect(typeof repo._strategy.getAggregateCommand).toBe('function');
    expect(typeof repo._strategy.extractAggregate).toBe('function');
  });

  test('constructor passes undefined region when not given', () => {
    const repo = new DynamoDBWalmartSlidingWindowRepository(
      'OtherTable',
    ) as any;
    expect(repo._tableName).toBe('OtherTable');
    expect(repo._region).toBeUndefined();
    expect(repo._strategy).toBeDefined();
  });

  describe('strategy.getAggregateCommand', () => {
    let strategy: any;

    beforeEach(() => {
      const repo = new DynamoDBWalmartSlidingWindowRepository('X', 'r') as any;
      strategy = repo._strategy;
    });

    test('creates a QueryCommand with correct properties for a string state', () => {
      const state = 'CA';
      const tableName = 'WalmartIndex';
      const cmd = strategy.getAggregateCommand(state, tableName);

      expect(cmd).toBeInstanceOf(QueryCommand);
      expect(cmd.input).toEqual({
        TableName: tableName,
        KeyConditionExpression: '#state = :state',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':state': state },
        ScanIndexForward: false,
        Limit: 1,
      });
    });

    test('preserves non-string state values (e.g., numeric or special chars) in ExpressionAttributeValues', () => {
      const weirdStates: any[] = [42, '123!@#', { toString: () => 'obj' }];

      for (const s of weirdStates) {
        const cmd = strategy.getAggregateCommand(s, 'T');
        expect(cmd.input.ExpressionAttributeValues[':state']).toBe(s);
      }
    });
  });

  describe('strategy.extractAggregate', () => {
    let strategy: any;

    beforeEach(() => {
      const repo = new DynamoDBWalmartSlidingWindowRepository('Y') as any;
      strategy = repo._strategy;
    });

    test('returns first item when Items is an array with at least one element (object)', () => {
      const item = { state: 'NY', value: 123 } as any;
      const out = strategy.extractAggregate({ Items: [item] });
      expect(out).toBe(item);
    });

    test('returns first item when Items is an array with primitive entries', () => {
      const out = strategy.extractAggregate({ Items: [42, 'a'] as any });
      expect(out).toBe(42);
    });

    test('returns null when response is null', () => {
      expect(strategy.extractAggregate(null)).toBeNull();
    });

    test('returns null when response is not an object (string, number, boolean, array without Items)', () => {
      expect(strategy.extractAggregate(123 as any)).toBeNull();
      expect(strategy.extractAggregate('string' as any)).toBeNull();
      expect(strategy.extractAggregate(true as any)).toBeNull();

      expect(strategy.extractAggregate([] as any)).toBeNull();
    });

    test('returns null when object has no Items property', () => {
      expect(strategy.extractAggregate({})).toBeNull();
      expect(strategy.extractAggregate({ foo: 'bar' })).toBeNull();
    });

    test('returns null when Items is not an array (undefined, object, string, number)', () => {
      expect(strategy.extractAggregate({ Items: undefined })).toBeNull();
      expect(strategy.extractAggregate({ Items: {} } as any)).toBeNull();
      expect(strategy.extractAggregate({ Items: 'str' } as any)).toBeNull();
      expect(strategy.extractAggregate({ Items: 5 } as any)).toBeNull();
    });

    test('returns null when Items is an empty array', () => {
      expect(strategy.extractAggregate({ Items: [] })).toBeNull();
    });

    test('defensive: if Items is present but contains a single null element, return that element (first element)', () => {
      expect(strategy.extractAggregate({ Items: [null] })).toBeNull();
    });

    test('does not throw if Items contains mixed types', () => {
      const mixed = [{ a: 1 }, 2, 'three'];
      const out = strategy.extractAggregate({ Items: mixed });
      expect(out).toBe(mixed[0]);
    });
  });
});
