import { DynamoDBBlockbusterIndexRepository } from './blockbuster-index-repository';
import type { BlockbusterIndexRecord } from '../../types/response';
import type { StateScore } from '../../types/states';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../util';

const mockGetCommand = GetCommand as jest.MockedClass<typeof GetCommand>;
const mockPutCommand = PutCommand as jest.MockedClass<typeof PutCommand>;
const mockQueryCommand = QueryCommand as jest.MockedClass<typeof QueryCommand>;

let queryCommandInput: any = null;
(mockQueryCommand as unknown as jest.Mock).mockImplementation((input) => {
  queryCommandInput = input;
});

type RepoPriv = DynamoDBBlockbusterIndexRepository & {
  client: { send: jest.MockedFunction<(cmd: unknown) => Promise<unknown>> };
};

const TABLE = 'test-blockbuster-index';

const makeRepo = () =>
  new DynamoDBBlockbusterIndexRepository(TABLE) as RepoPriv;

const sampleRecord: BlockbusterIndexRecord = {
  timestamp: 1_720_000_000,
  calculatedAt: '2025-07-20T00:00:00Z',
  version: 'Jul2025‑v1',
  totalStates: 51,
  states: {
    CA: { rank: 1, score: 0.91 } as unknown as StateScore,
    OR: { rank: 2, score: 0.9 } as unknown as StateScore,
  },
  signalStatus: { total: 51, successful: 49, failed: 2 },
};

describe('DynamoDBBlockbusterIndexRepository', () => {
  let repo: RepoPriv;
  let send: jest.MockedFunction<(cmd: unknown) => Promise<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    queryCommandInput = null;
    repo = makeRepo();
    send = repo.client.send;
  });

  describe('save', () => {
    it('writes a new record and logs success', async () => {
      send.mockResolvedValueOnce({});

      await repo.save(sampleRecord);

      expect(mockPutCommand).toHaveBeenCalledWith({
        Item: {
          timestamp: sampleRecord.timestamp,
          calculatedAt: sampleRecord.calculatedAt,
          version: sampleRecord.version,
          totalStates: sampleRecord.totalStates,
          states: sampleRecord.states,
          signalStatus: sampleRecord.signalStatus,
        },
        TableName: TABLE,
        ConditionExpression: 'attribute_not_exists(#timestamp)',
        ExpressionAttributeNames: { '#timestamp': 'timestamp' },
      });
      expect(send).toHaveBeenCalledWith(expect.any(PutCommand));
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully saved blockbuster index record',
        {
          timestamp: sampleRecord.timestamp,
          version: sampleRecord.version,
          totalStates: sampleRecord.totalStates,
        },
      );
    });

    it('swallows ConditionalCheckFailedException (duplicate)', async () => {
      const dupErr = Object.assign(new Error('dup'), {
        name: 'ConditionalCheckFailedException',
      });
      send.mockRejectedValueOnce(dupErr);

      await expect(repo.save(sampleRecord)).resolves.toBeUndefined();

      expect(logger.info).toHaveBeenCalledWith(
        'Blockbuster index record already exists, skipping duplicate',
        { timestamp: sampleRecord.timestamp },
      );
    });

    it('re‑throws unknown DynamoDB errors and logs', async () => {
      const svcErr = Object.assign(new Error('DDB down'), {
        name: 'ServiceUnavailable',
      });
      send.mockRejectedValueOnce(svcErr);

      await expect(repo.save(sampleRecord)).rejects.toThrow('DDB down');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save blockbuster index record',
        expect.objectContaining({ error: 'DDB down' }),
      );
    });

    it('re‑throws non‑Error rejection values', async () => {
      send.mockRejectedValueOnce('totally‑unexpected');

      await expect(repo.save(sampleRecord)).rejects.toBe('totally‑unexpected');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save blockbuster index record',
        expect.objectContaining({ error: 'totally‑unexpected' }),
      );
    });
  });

  describe('exists', () => {
    it('returns true when Item present', async () => {
      send.mockResolvedValueOnce({ Item: { timestamp: 1 } });

      await expect(repo.exists(1)).resolves.toBe(true);
      expect(mockGetCommand).toHaveBeenCalledWith({
        TableName: TABLE,
        Key: { timestamp: 1 },
      });
    });

    it('returns false when Item missing', async () => {
      send.mockResolvedValueOnce({ Item: undefined });
      await expect(repo.exists(1)).resolves.toBe(false);
    });

    it('uses current epoch when timestamp omitted', async () => {
      jest.useFakeTimers().setSystemTime(1_800_000_000_000);
      send.mockResolvedValueOnce({ Item: null });

      await repo.exists();

      expect(mockGetCommand).toHaveBeenCalledWith({
        TableName: TABLE,
        Key: { timestamp: Math.floor(Date.now() / 1000) },
      });
      jest.useRealTimers();
    });

    it('logs and re‑throws on error', async () => {
      const err = new Error('boom');
      send.mockRejectedValueOnce(err);

      await expect(repo.exists(1)).rejects.toThrow('boom');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check if blockbuster index record exists',
        expect.objectContaining({ error: 'boom' }),
      );
    });

    it('logs and re‑throws non‑Error rejection values', async () => {
      const nonErrorValue = { some: 'weird object' };
      send.mockRejectedValueOnce(nonErrorValue);

      await expect(repo.exists(1)).rejects.toBe(nonErrorValue);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check if blockbuster index record exists',
        expect.objectContaining({ error: '[object Object]' }),
      );
    });
  });

  describe('get', () => {
    it('returns hydrated BlockbusterIndexRecord', async () => {
      send.mockResolvedValueOnce({ Item: sampleRecord });

      const result = await repo.get(sampleRecord.timestamp);
      expect(result).toEqual(sampleRecord);

      expect(mockGetCommand).toHaveBeenCalledWith({
        TableName: TABLE,
        Key: { timestamp: sampleRecord.timestamp },
      });
    });

    it('returns null when Item undefined', async () => {
      send.mockResolvedValueOnce({});
      await expect(repo.get(2)).resolves.toBeNull();
    });

    it('returns null when Item null', async () => {
      send.mockResolvedValueOnce({ Item: null });
      await expect(repo.get(2)).resolves.toBeNull();
    });

    it('uses current epoch when timestamp omitted', async () => {
      jest.useFakeTimers().setSystemTime(1_900_000_000_000);
      send.mockResolvedValueOnce({ Item: null });

      await repo.get();

      expect(mockGetCommand).toHaveBeenCalledWith({
        TableName: TABLE,
        Key: { timestamp: Math.floor(Date.now() / 1000) },
      });
      jest.useRealTimers();
    });

    it('logs and re‑throws on error', async () => {
      const err = new Error('get‑fail');
      send.mockRejectedValueOnce(err);

      await expect(repo.get(3)).rejects.toThrow('get‑fail');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get blockbuster index record',
        expect.objectContaining({ error: 'get‑fail' }),
      );
    });

    it('logs and re‑throws non‑Error rejection values', async () => {
      const nonErrorValue = 12345;
      send.mockRejectedValueOnce(nonErrorValue);

      await expect(repo.get(3)).rejects.toBe(nonErrorValue);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get blockbuster index record',
        expect.objectContaining({ error: '12345' }),
      );
    });
  });

  describe('query', () => {
    const start = 100;
    const end = 200;

    it('maps Items → BlockbusterIndexRecord[]', async () => {
      const items = [sampleRecord, { ...sampleRecord, timestamp: 2 }];
      send.mockResolvedValueOnce({ Items: items });

      const result = await repo.query(start, end);

      expect(result).toEqual(items);
      expect(queryCommandInput).toEqual({
        TableName: TABLE,
        KeyConditionExpression: '#ts BETWEEN :start AND :end',
        ExpressionAttributeValues: { ':start': start, ':end': end },
        ExpressionAttributeNames: { '#ts': 'timestamp' },
      });
    });

    it('uses defaults when args omitted', async () => {
      jest.useFakeTimers().setSystemTime(1_000_000_000_000);
      send.mockResolvedValueOnce({ Items: [] });

      await repo.query();

      expect(queryCommandInput).toEqual({
        TableName: TABLE,
        KeyConditionExpression: '#ts BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':start': 0,
          ':end': Math.floor(Date.now() / 1000),
        },
        ExpressionAttributeNames: { '#ts': 'timestamp' },
      });
      jest.useRealTimers();
    });

    it('returns empty array when Items undefined', async () => {
      send.mockResolvedValueOnce({});
      await expect(repo.query()).resolves.toEqual([]);
    });

    it('logs and re‑throws on error', async () => {
      const err = new Error('query‑fail');
      send.mockRejectedValueOnce(err);

      await expect(repo.query()).rejects.toThrow('query‑fail');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to query blockbuster index records',
        expect.objectContaining({ error: 'query‑fail' }),
      );
    });

    it('logs and re‑throws non‑Error rejection values', async () => {
      const nonErrorValue = 'unexpected string error';
      send.mockRejectedValueOnce(nonErrorValue);

      await expect(repo.query()).rejects.toBe(nonErrorValue);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to query blockbuster index records',
        expect.objectContaining({ error: 'unexpected string error' }),
      );
    });
  });

  it('constructs with default region', () => {
    expect(() => new DynamoDBBlockbusterIndexRepository(TABLE)).not.toThrow();
  });

  it('constructs with custom region', () => {
    expect(
      () => new DynamoDBBlockbusterIndexRepository(TABLE, 'us‑east‑1'),
    ).not.toThrow();
  });
});
