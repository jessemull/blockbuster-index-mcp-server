jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { WalmartSlidingWindowService } from './walmart-sliding-window-service';
import { logger } from '../../util';

describe('WalmartSlidingWindowService', () => {
  let mockGetAggregate: jest.Mock;
  let mockUpdateAggregate: jest.Mock;
  let mockSaveAggregate: jest.Mock;
  let mockJobGet: jest.Mock;
  let mockGetOldDayJobCount: jest.Mock;
  let windowRepository: any;
  let jobRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00Z'));
    mockGetAggregate = jest.fn();
    mockUpdateAggregate = jest.fn();
    mockSaveAggregate = jest.fn();
    mockJobGet = jest.fn();
    mockGetOldDayJobCount = jest.fn();
    windowRepository = {
      getAggregate: mockGetAggregate,
      updateAggregate: mockUpdateAggregate,
      saveAggregate: mockSaveAggregate,
    };
    jobRepository = {
      get: mockJobGet,
    };
  });

  const baseTimestamp = 1700000000000;

  it('creates a new aggregate if none exists', async () => {
    mockGetAggregate.mockResolvedValueOnce(undefined);
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA'],
    });
    await service.updateSlidingWindow('CA', 50, baseTimestamp);
    expect(mockSaveAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'CA',
        windowStart: baseTimestamp,
        windowEnd: baseTimestamp,
        totalJobCount: 50,
        dayCount: 1,
        averageJobCount: 50,
      }),
    );
    expect(mockUpdateAggregate).not.toHaveBeenCalled();
    expect(mockGetOldDayJobCount).not.toHaveBeenCalled();
  });

  it('updates aggregate and removes oldest day if needed', async () => {
    mockGetAggregate.mockResolvedValueOnce({ windowStart: baseTimestamp });
    mockGetOldDayJobCount.mockResolvedValueOnce(undefined);
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA'],
    });
    await service.updateSlidingWindow('CA', 75, baseTimestamp + 86400000 * 91); // simulate 91 days later
    expect(mockGetOldDayJobCount).toHaveBeenCalledWith('CA', baseTimestamp);
    expect(mockUpdateAggregate).toHaveBeenCalledWith(
      'CA',
      75,
      baseTimestamp + 86400000 * 91,
      undefined,
      undefined,
    );
    expect(mockSaveAggregate).not.toHaveBeenCalled();
  });

  it('updates aggregate without removing oldest day if not needed', async () => {
    mockGetAggregate.mockResolvedValueOnce({ windowStart: baseTimestamp });
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA'],
    });
    await service.updateSlidingWindow('CA', 60, baseTimestamp + 86400000 * 1); // next day
    expect(mockUpdateAggregate).toHaveBeenCalledWith(
      'CA',
      60,
      baseTimestamp + 86400000 * 1,
      undefined,
      undefined,
    );
    expect(mockSaveAggregate).not.toHaveBeenCalled();
    expect(mockGetOldDayJobCount).not.toHaveBeenCalled();
  });

  it('handles case where old day record is not found', async () => {
    mockGetAggregate.mockResolvedValueOnce({ windowStart: baseTimestamp });
    mockGetOldDayJobCount.mockResolvedValueOnce(undefined);
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA'],
    });
    await service.updateSlidingWindow('CA', 80, baseTimestamp + 86400000 * 91);
    expect(mockGetOldDayJobCount).toHaveBeenCalledWith('CA', baseTimestamp);
    expect(mockUpdateAggregate).toHaveBeenCalledWith(
      'CA',
      80,
      baseTimestamp + 86400000 * 91,
      undefined,
      undefined,
    );
    expect(mockSaveAggregate).not.toHaveBeenCalled();
  });

  it('handles repository errors in updateSlidingWindow', async () => {
    mockGetAggregate.mockRejectedValueOnce(new Error('fail'));
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA'],
    });
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
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA', 'TX', 'NY'],
    });
    const result = await service.getSlidingWindowScores();
    expect(result.CA).toBe(100);
    expect(result.TX).toBe(50);
    expect(result.NY).toBe(0);
  });

  it('handles errors in getSlidingWindowScores', async () => {
    mockGetAggregate.mockRejectedValueOnce(new Error('fail'));
    const service = new WalmartSlidingWindowService({
      windowRepository,
      jobRepository,
      getOldDayJobCount: mockGetOldDayJobCount,
      states: ['CA'],
    });
    await expect(service.getSlidingWindowScores()).rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });
});
