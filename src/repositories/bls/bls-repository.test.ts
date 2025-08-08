const infoMock = jest.fn();
const warnMock = jest.fn();
const errorMock = jest.fn();

jest.mock('../../util', () => ({
  logger: {
    info: infoMock,
    warn: warnMock,
    error: errorMock,
  },
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    GetCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
    PutCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
    QueryCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
    ScanCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
    BatchWriteCommand: jest
      .fn()
      .mockImplementation((input: unknown) => ({ input })),
    ScanCommandOutput: class ScanCommandOutput {},
  };
});

const sendMockFactory = () => jest.fn();

let globalSendMock = sendMockFactory();

jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => {
      return {
        send: globalSendMock,
      };
    }),
  };
});

import { DynamoDBBlsRepository } from './bls-repository';

describe('DynamoDBBlsRepository', () => {
  const processedFilesTable = 'processed-files';
  const stateDataTable = 'state-data';
  const signalsTable = 'signals-table';

  let repo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    globalSendMock = sendMockFactory();

    const clientModule = jest.requireMock('@aws-sdk/client-dynamodb');
    clientModule.DynamoDBClient.mockImplementation(() => ({
      send: globalSendMock,
    }));

    repo = new DynamoDBBlsRepository(
      processedFilesTable,
      stateDataTable,
      signalsTable,
    );
    process.env.AWS_REGION = 'us-west-2';
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  test('saveProcessedFile - success path logs info', async () => {
    const file = {
      year: '2020',
      processedAt: 12345,
      fileSize: 1000,
      recordCount: 200,
    };

    globalSendMock.mockResolvedValue({});

    await expect(repo.saveProcessedFile(file)).resolves.toBeUndefined();

    expect(globalSendMock).toHaveBeenCalledTimes(1);

    expect(infoMock).toHaveBeenCalledWith(
      'Successfully saved processed file record',
      {
        year: file.year,
        processedAt: file.processedAt,
      },
    );
  });

  test('saveProcessedFile - conditional check failed logs and returns', async () => {
    const file = {
      year: '2021',
      processedAt: 9999,
      fileSize: 50,
      recordCount: 1,
    };

    const err = new Error('conditional failed');
    err.name = 'ConditionalCheckFailedException';
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveProcessedFile(file)).resolves.toBeUndefined();

    // should log info about skipping duplicate
    expect(infoMock).toHaveBeenCalledWith(
      'File already processed, skipping duplicate',
      {
        year: file.year,
      },
    );
  });

  test('saveProcessedFile - other error logs error and rethrows', async () => {
    const file = {
      year: '2022',
      processedAt: 5555,
      fileSize: 123,
      recordCount: 10,
    };

    const err = new Error('some other failure');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveProcessedFile(file)).rejects.toThrow(
      'some other failure',
    );

    expect(errorMock).toHaveBeenCalled();
    // Confirm error message contains file.year
    const calledWith = errorMock.mock.calls[0][1];
    expect(calledWith.year).toBe(file.year);
  });
  test('isFileProcessed - returns true when item present', async () => {
    globalSendMock.mockResolvedValue({ Item: { year: '2020' } });

    await expect(repo.isFileProcessed('2020')).resolves.toBe(true);
    expect(globalSendMock).toHaveBeenCalledTimes(1);
  });

  test('isFileProcessed - returns false when no item', async () => {
    globalSendMock.mockResolvedValue({});

    await expect(repo.isFileProcessed('2019')).resolves.toBe(false);
  });

  test('isFileProcessed - logs and rethrows on client error', async () => {
    const err = new Error('get failure');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.isFileProcessed('bad')).rejects.toThrow('get failure');

    expect(errorMock).toHaveBeenCalled();
    const meta = errorMock.mock.calls[0][1];
    expect(meta.year).toBe('bad');
  });
  test('saveStateData - success logs counts', async () => {
    const data = {
      state: 'CA',
      year: 2020,
      timestamp: 1000,
      brickAndMortarCodes: { a: 1, b: 2 },
      ecommerceCodes: { x: 5 },
    };

    globalSendMock.mockResolvedValue({});

    await expect(repo.saveStateData(data)).resolves.toBeUndefined();

    expect(infoMock).toHaveBeenCalledWith('Successfully saved state data', {
      state: data.state,
      year: data.year,
      brickAndMortarCodeCount: 2,
      ecommerceCodeCount: 1,
    });
  });

  test('saveStateData - conditional duplicate returns and logs', async () => {
    const data = {
      state: 'OR',
      year: 2021,
      timestamp: 2000,
      brickAndMortarCodes: {},
      ecommerceCodes: {},
    };

    const err = new Error('duplicate');
    err.name = 'ConditionalCheckFailedException';
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveStateData(data)).resolves.toBeUndefined();

    expect(infoMock).toHaveBeenCalledWith(
      'State data already exists, skipping duplicate',
      {
        state: data.state,
        year: data.year,
      },
    );
  });

  test('saveStateData - other error logs and rethrows', async () => {
    const data = {
      state: 'WA',
      year: 2018,
      timestamp: 1111,
      brickAndMortarCodes: {},
      ecommerceCodes: {},
    };

    const err = new Error('db down');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveStateData(data)).rejects.toThrow('db down');

    expect(errorMock).toHaveBeenCalled();
    const meta = errorMock.mock.calls[0][1];
    expect(meta.state).toBe(data.state);
    expect(meta.year).toBe(data.year);
  });
  test('saveStateDataBatch - single batch works and logs', async () => {
    const smallArray = Array.from({ length: 3 }, (_, i) => ({
      state: `S${i}`,
      year: 2000 + i,
      timestamp: 100 + i,
      brickAndMortarCodes: { a: 1 },
      ecommerceCodes: { b: 2 },
    }));

    globalSendMock.mockResolvedValue({});

    await expect(repo.saveStateDataBatch(smallArray)).resolves.toBeUndefined();

    // send should have been called once
    expect(globalSendMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(
      `Saved batch of ${smallArray.length} state data records`,
    );
  });

  test('saveStateDataBatch - multiple batches ( >25 ) loops correctly', async () => {
    const many = Array.from({ length: 27 }, (_, i) => ({
      state: `S${i}`,
      year: 2000 + i,
      timestamp: 1000 + i,
      brickAndMortarCodes: { a: i },
      ecommerceCodes: { b: i },
    }));

    globalSendMock.mockResolvedValue({});

    await expect(repo.saveStateDataBatch(many)).resolves.toBeUndefined();

    // expect two sends (one per batch)
    expect(globalSendMock).toHaveBeenCalledTimes(2);

    // first call logged for first batch (25)
    expect(infoMock).toHaveBeenCalledWith(
      `Saved batch of 25 state data records`,
    );
    // second call logged for second batch (2)
    expect(infoMock).toHaveBeenCalledWith(
      `Saved batch of 2 state data records`,
    );
  });

  test('saveStateDataBatch - error logs and throws', async () => {
    const arr = [
      {
        state: 'X',
        year: 1,
        timestamp: 1,
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      },
    ];

    const err = new Error('batch failure');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveStateDataBatch(arr)).rejects.toThrow('batch failure');

    const meta = errorMock.mock.calls[0][1];
    expect(meta.recordCount).toBe(arr.length);
  });
  test('getStateData - returns mapped object when Item exists', async () => {
    const item = {
      state: 'NM',
      year: 2024,
      timestamp: 777,
      brickAndMortarCodes: { c: 2 },
      ecommerceCodes: { d: 3 },
    };

    globalSendMock.mockResolvedValue({ Item: item });

    const result = await repo.getStateData('NM', 2024);

    expect(result).toEqual({
      state: 'NM',
      year: 2024,
      timestamp: 777,
      brickAndMortarCodes: { c: 2 },
      ecommerceCodes: { d: 3 },
    });
  });

  test('getStateData - returns null when no Item', async () => {
    globalSendMock.mockResolvedValue({});

    await expect(repo.getStateData('AA', 1999)).resolves.toBeNull();
  });

  test('getStateData - logs and throws on error', async () => {
    const err = new Error('cannot get');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.getStateData('Z', 1900)).rejects.toThrow('cannot get');

    const meta = errorMock.mock.calls[0][1];
    expect(meta.state).toBe('Z');
    expect(meta.year).toBe(1900);
  });
  test('getAllStateDataForYear - returns [] when none', async () => {
    globalSendMock.mockResolvedValue({ Items: [] });

    const res = await repo.getAllStateDataForYear(2020);
    expect(res).toEqual([]);
  });

  test('getAllStateDataForYear - maps items correctly', async () => {
    const items = [
      {
        state: 'A',
        year: 2019,
        timestamp: 1,
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      },
      {
        state: 'B',
        year: 2019,
        timestamp: 2,
        brickAndMortarCodes: {},
        ecommerceCodes: {},
      },
    ];

    globalSendMock.mockResolvedValue({ Items: items });

    const res = await repo.getAllStateDataForYear(2019);
    expect(res).toHaveLength(2);
    expect(res[0].state).toBe('A');
    expect(res[1].state).toBe('B');
  });

  test('getAllStateDataForYear - logs and throws on error', async () => {
    const err = new Error('scan fail');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.getAllStateDataForYear(1)).rejects.toThrow('scan fail');
    expect(errorMock).toHaveBeenCalled();
  });
  test('getAllUniqueStates - returns [] when empty', async () => {
    globalSendMock.mockResolvedValue({ Items: [] });

    const res = await repo.getAllUniqueStates();
    expect(res).toEqual([]);
  });

  test('getAllUniqueStates - returns unique values', async () => {
    const items = [
      { state: 'CA' },
      { state: 'CA' },
      { state: 'WA' },
      { state: 'OR' },
      { state: 'WA' },
    ];
    globalSendMock.mockResolvedValue({ Items: items });

    const res = await repo.getAllUniqueStates();
    // Should be unique; order may be preserved by set but check membership
    expect(res).toEqual(expect.arrayContaining(['CA', 'WA', 'OR']));
    expect(res.length).toBe(3);
  });

  test('getAllUniqueStates - logs and throws on error', async () => {
    const err = new Error('unique fail');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.getAllUniqueStates()).rejects.toThrow('unique fail');
    expect(errorMock).toHaveBeenCalled();
  });
  test('getAllStateDataForState - uses GSI and paginates until done', async () => {
    const page1 = {
      Items: [
        {
          state: 'S',
          year: 2001,
          timestamp: 1,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ],
      LastEvaluatedKey: { k: 'more' },
    };
    const page2 = {
      Items: [
        {
          state: 'S',
          year: 2002,
          timestamp: 2,
          brickAndMortarCodes: {},
          ecommerceCodes: {},
        },
      ],
      LastEvaluatedKey: undefined,
    };

    let call = 0;
    globalSendMock.mockImplementation(async () => {
      call += 1;
      if (call === 1) return page1;
      if (call === 2) return page2;
      return {};
    });

    const res = await repo.getAllStateDataForState('S');
    expect(res.length).toBe(2);
    expect(res.map((r: any) => r.year)).toEqual([2001, 2002]);
  });

  test('getAllStateDataForState - GSI error not ResourceNotFound rethrows', async () => {
    const gsiErr = new Error('bad gsi');
    gsiErr.name = 'SomeOtherException';

    globalSendMock.mockImplementation(async () => {
      throw gsiErr;
    });

    await expect(repo.getAllStateDataForState('X')).rejects.toThrow('bad gsi');
  });

  test('getAllStateDataForState - outer error logs and rethrows', async () => {
    const err = new Error('outer failure');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.getAllStateDataForState('Y')).rejects.toThrow(
      'outer failure',
    );
    const meta = errorMock.mock.calls[0][1];
    expect(meta.state).toBe('Y');
  });
  test('saveSignal - success logs info', async () => {
    const record = {
      state: '06',
      timestamp: 100,
      calculatedAt: 'when',
      physicalSlope: 1.1,
      physicalTrend: 'growing',
      ecommerceSlope: 0.5,
      ecommerceTrend: 'declining',
      physicalScore: 10,
      ecommerceScore: 20,
      dataPoints: 2,
      yearsAnalyzed: [2019, 2020],
    };

    globalSendMock.mockResolvedValue({});

    await expect(repo.saveSignal(record)).resolves.toBeUndefined();

    expect(infoMock).toHaveBeenCalledWith(
      'Successfully saved BLS signal record',
      {
        state: record.state,
        timestamp: record.timestamp,
        physicalScore: record.physicalScore,
        ecommerceScore: record.ecommerceScore,
      },
    );
  });

  test('saveSignal - duplicate conditional returns and logs', async () => {
    const record = {
      state: '07',
      timestamp: 200,
      calculatedAt: 'now',
      physicalSlope: 1,
      physicalTrend: 'stable',
      ecommerceSlope: -1,
      ecommerceTrend: 'stable',
      physicalScore: 5,
      ecommerceScore: 6,
      dataPoints: 3,
      yearsAnalyzed: [2018],
    };

    const err = new Error('dup');
    err.name = 'ConditionalCheckFailedException';
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveSignal(record)).resolves.toBeUndefined();

    expect(infoMock).toHaveBeenCalledWith(
      'Signal record already exists, skipping duplicate',
      {
        state: record.state,
        timestamp: record.timestamp,
      },
    );
  });

  test('saveSignal - other error logs and rethrows', async () => {
    const record = {
      state: '08',
      timestamp: 300,
      calculatedAt: 'later',
      physicalSlope: 2,
      physicalTrend: 'declining',
      ecommerceSlope: 2,
      ecommerceTrend: 'growing',
      physicalScore: 8,
      ecommerceScore: 9,
      dataPoints: 4,
      yearsAnalyzed: [2016, 2017],
    };

    const err = new Error('signal fail');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.saveSignal(record)).rejects.toThrow('signal fail');

    const meta = errorMock.mock.calls[0][1];
    expect(meta.state).toBe(record.state);
  });
  test('getLatestSignal - returns null when no items', async () => {
    globalSendMock.mockResolvedValue({ Items: [] });

    await expect(repo.getLatestSignal('06')).resolves.toBeNull();
  });

  test('getLatestSignal - returns mapped record when available', async () => {
    const item = {
      state_fips: '09',
      timestamp: 999,
      calculatedAt: 'calc',
      physicalSlope: 1.2,
      physicalTrend: 'stable',
      ecommerceSlope: 0.2,
      ecommerceTrend: 'growing',
      physicalScore: 12,
      ecommerceScore: 13,
      dataPoints: 10,
      yearsAnalyzed: [2010, 2011],
    };

    globalSendMock.mockResolvedValue({ Items: [item] });

    const res = await repo.getLatestSignal('09');

    expect(res).toEqual({
      state: '09',
      timestamp: 999,
      calculatedAt: 'calc',
      physicalSlope: 1.2,
      physicalTrend: 'stable',
      ecommerceSlope: 0.2,
      ecommerceTrend: 'growing',
      physicalScore: 12,
      ecommerceScore: 13,
      dataPoints: 10,
      yearsAnalyzed: [2010, 2011],
    });
  });

  test('getLatestSignal - logs and rethrows on error', async () => {
    const err = new Error('query fail');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.getLatestSignal('00')).rejects.toThrow('query fail');

    expect(errorMock).toHaveBeenCalled();
    const meta = errorMock.mock.calls[0][1];
    expect(meta.state).toBe('00');
  });
  test('getAllSignals - paginates using Scan until LastEvaluatedKey falsy', async () => {
    const page1 = {
      Items: [
        {
          state_fips: '10',
          timestamp: 1,
          calculatedAt: 'a',
          physicalSlope: 1,
          physicalTrend: 'growing',
          ecommerceSlope: 2,
          ecommerceTrend: 'stable',
          physicalScore: 1,
          ecommerceScore: 2,
          dataPoints: 3,
          yearsAnalyzed: [2000],
        },
      ],
      LastEvaluatedKey: { k: 'next' },
    };
    const page2 = {
      Items: [
        {
          state_fips: '11',
          timestamp: 2,
          calculatedAt: 'b',
          physicalSlope: 2,
          physicalTrend: 'declining',
          ecommerceSlope: 3,
          ecommerceTrend: 'growing',
          physicalScore: 4,
          ecommerceScore: 5,
          dataPoints: 6,
          yearsAnalyzed: [2001],
        },
      ],
      LastEvaluatedKey: undefined,
    };

    let call = 0;
    globalSendMock.mockImplementation(async () => {
      call++;
      if (call === 1) return page1;
      if (call === 2) return page2;
      return {};
    });

    const res = await repo.getAllSignals();
    expect(res.length).toBe(2);
    expect(res[0].state).toBe('10');
    expect(res[1].state).toBe('11');
  });

  test('getAllSignals - returns [] when no Items at all', async () => {
    globalSendMock.mockResolvedValue({ Items: [] });

    const res = await repo.getAllSignals();
    expect(res).toEqual([]);
  });

  test('getAllSignals - logs and rethrows on error', async () => {
    const err = new Error('scan signals fail');
    globalSendMock.mockRejectedValue(err);

    await expect(repo.getAllSignals()).rejects.toThrow('scan signals fail');

    expect(errorMock).toHaveBeenCalled();
  });
});
