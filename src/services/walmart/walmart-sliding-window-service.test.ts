jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockGetAggregate = jest.fn();
const mockUpdateAggregate = jest.fn();
const mockSaveAggregate = jest.fn();
const mockJobGet = jest.fn();

jest.mock('../../repositories/walmart', () => ({
  DynamoDBWalmartSlidingWindowRepository: jest.fn().mockImplementation(() => ({
    getAggregate: mockGetAggregate,
    updateAggregate: mockUpdateAggregate,
    saveAggregate: mockSaveAggregate,
  })),
}));

jest.mock('../../repositories/walmart/walmart-physical-repository', () => ({
  DynamoDBWalmartJobRepository: jest.fn().mockImplementation(() => ({
    get: mockJobGet,
  })),
}));

import { WalmartSlidingWindowService } from './walmart-sliding-window-service';
import { logger } from '../../util';

describe('WalmartSlidingWindowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  const baseTimestamp = 1700000000000;

  it('creates a new aggregate if none exists', async () => {
    mockGetAggregate.mockResolvedValueOnce(undefined);
    const service = new WalmartSlidingWindowService();
    await service.updateSlidingWindow('CA', 50, baseTimestamp);
    expect(mockSaveAggregate).toHaveBeenCalled();
  });

  it('updates an existing aggregate', async () => {
    mockGetAggregate.mockResolvedValueOnce({
      state: 'CA',
      windowStart: baseTimestamp,
      totalJobCount: 100,
      dayCount: 2,
      averageJobCount: 50,
    });
    const service = new WalmartSlidingWindowService();
    await service.updateSlidingWindow('CA', 50, baseTimestamp);
    expect(mockUpdateAggregate).toHaveBeenCalled();
  });

  it('handles repository errors in updateSlidingWindow', async () => {
    mockGetAggregate.mockRejectedValueOnce(new Error('fail'));
    const service = new WalmartSlidingWindowService();
    await expect(
      service.updateSlidingWindow('CA', 100, baseTimestamp),
    ).rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns correct scores for states', async () => {
    mockGetAggregate.mockImplementation(async (state: string) => {
      if (state === 'CA') return { averageJobCount: 99.6 };
      if (state === 'TX') return { averageJobCount: 50.3 };
      return undefined;
    });
    const service = new WalmartSlidingWindowService();
    const result = await service.getSlidingWindowScores();
    expect(result.CA).toBe(100);
    expect(result.TX).toBe(50);
    expect(result.NY).toBe(0);
  });

  it('handles errors in getSlidingWindowScores', async () => {
    mockGetAggregate.mockRejectedValueOnce(new Error('fail'));
    const service = new WalmartSlidingWindowService();
    await expect(service.getSlidingWindowScores()).rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });
});
