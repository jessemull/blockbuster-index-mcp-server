import { DynamoDBSignalScoresRepository } from './signal-scores-repository';

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    config: {},
  })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  },
  GetCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  PutCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ input: params })),
}));

jest.mock('../../util', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('signal scores DynamoDB marshalling', () => {
  let repository: DynamoDBSignalScoresRepository;
  let mockSend: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSend = jest.fn();

    const { DynamoDBDocumentClient } = jest.requireMock(
      '@aws-sdk/lib-dynamodb',
    );
    DynamoDBDocumentClient.from.mockReturnValue({
      send: mockSend,
    });

    repository = new DynamoDBSignalScoresRepository('test-table');
  });

  it('should marshal PutCommand Item with exact keys and types on save', async () => {
    mockSend.mockResolvedValue({});

    const record = {
      calculatedAt: '2024-01-01T00:00:00Z',
      scores: {
        CA: 0.8,
        TX: 0.7,
      },
      signalType: 'AMAZON',
      timestamp: 1_234_567_890,
    };

    await repository.save(record);

    const putCall = mockSend.mock.calls[0]?.[0] as {
      input: { Item: Record<string, unknown> };
    };
    const item = putCall.input.Item;
    const itemKeys = Object.keys(item).sort();

    expect(itemKeys).toEqual([
      'calculatedAt',
      'scores',
      'signalType',
      'timestamp',
    ]);
    expect(typeof item.signalType).toBe('string');
    expect(typeof item.timestamp).toBe('number');
    expect(typeof item.calculatedAt).toBe('string');
    expect(typeof item.scores).toBe('object');
    expect(item.scores).not.toBeNull();
    expect(Array.isArray(item.scores)).toBe(false);

    const scores = item.scores as Record<string, number>;

    expect(
      Object.values(scores).every((value) => typeof value === 'number'),
    ).toBe(true);
    expect(scores).toEqual(record.scores);
  });

  it('should round-trip get after save with the same scores shape', async () => {
    const record = {
      calculatedAt: '2024-01-01T00:00:00Z',
      scores: {
        CA: 0.8,
        TX: 0.7,
      },
      signalType: 'AMAZON',
      timestamp: 1_234_567_890,
    };

    mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: record });

    await repository.save(record);
    const result = await repository.get(record.signalType, record.timestamp);

    expect(result).toEqual(record);
    expect(typeof result?.scores.CA).toBe('number');
    expect(typeof result?.scores.TX).toBe('number');
  });
});
