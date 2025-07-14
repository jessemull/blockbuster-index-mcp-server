import { BroadbandSignalRecord } from '../../types';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband-signal-repository';
import { States } from '../../types';
import { loadExistingBroadbandData } from './load-existing-broadband-data';
import { logger } from '../../util/logger';

const mockGet = jest.fn();

jest.mock('../../repositories/broadband-signal-repository', () => ({
  DynamoDBBroadbandSignalRepository: jest.fn().mockImplementation(() => ({
    get: mockGet,
  })),
}));

jest.mock('../../util/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('loadExistingBroadbandData', () => {
  const mockRepository = new DynamoDBBroadbandSignalRepository('mock-table');
  const timestamp = 1721000000000;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns scores for all states with valid records', async () => {
    mockGet.mockImplementation(
      (state: string): Promise<BroadbandSignalRecord> =>
        Promise.resolve({
          state,
          timestamp,
          broadbandScore: 75,
        } as BroadbandSignalRecord),
    );

    const scores = await loadExistingBroadbandData(mockRepository, timestamp);

    for (const state of Object.values(States)) {
      expect(scores[state]).toBe(75);
    }

    expect(logger.info).toHaveBeenCalledWith(
      'Loaded existing broadband data',
      expect.objectContaining({
        statesWithData: Object.values(States).length,
        totalStates: Object.values(States).length,
      }),
    );
  });

  it('sets score to 0 when no record is found', async () => {
    mockGet.mockImplementation(() => Promise.resolve(null));

    const scores = await loadExistingBroadbandData(mockRepository, timestamp);

    for (const state of Object.values(States)) {
      expect(scores[state]).toBe(0);
    }

    expect(logger.info).toHaveBeenCalled();
  });

  it('sets score to 0 when repository.get throws an error', async () => {
    mockGet.mockImplementation(() => {
      return Promise.reject(new Error('fail'));
    });

    const scores = await loadExistingBroadbandData(mockRepository, timestamp);

    for (const state of Object.values(States)) {
      expect(scores[state]).toBe(0);
    }

    expect(logger.error).toHaveBeenCalledTimes(Object.values(States).length);
    expect(logger.info).toHaveBeenCalled();
  });
});
