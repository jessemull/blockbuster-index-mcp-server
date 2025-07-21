import { WalmartSlidingWindowService } from './walmart-sliding-window-service';
import { logger } from '../../util';

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

jest.mock('../../repositories/walmart', () => ({
  DynamoDBWalmartSlidingWindowRepository: jest.fn().mockImplementation(() => ({
    getAggregate: mockGetAggregate,
    updateAggregate: mockUpdateAggregate,
    saveAggregate: mockSaveAggregate,
  })),
}));

describe('WalmartSlidingWindowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  const service = new WalmartSlidingWindowService();
  const baseTimestamp = 1700000000000;
  const oldTimestamp = baseTimestamp - 91 * 24 * 60 * 60 * 1000;

  describe('updateSlidingWindow', () => {
    it('creates a new aggregate if none exists', async () => {
      mockGetAggregate.mockResolvedValueOnce(undefined);

      await service.updateSlidingWindow('CA', 'retail', 50, baseTimestamp);

      expect(mockSaveAggregate).toHaveBeenCalledWith(
        {
          state: 'CA',
          jobType: 'retail',
          windowStart: baseTimestamp,
          windowEnd: baseTimestamp,
          totalJobCount: 50,
          dayCount: 1,
          averageJobCount: 50,
          lastUpdated: expect.any(Number),
        },
        'retail',
      );
    });

    it('updates an existing aggregate without needing to slide window', async () => {
      mockGetAggregate.mockResolvedValueOnce({
        state: 'CA',
        jobType: 'retail',
        windowStart: baseTimestamp,
        totalJobCount: 100,
        dayCount: 2,
        averageJobCount: 50,
      });

      await service.updateSlidingWindow('CA', 'retail', 50, baseTimestamp);

      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        'retail',
        50,
        baseTimestamp,
        undefined,
        undefined,
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Successfully updated Walmart sliding window:',
        expect.objectContaining({
          state: 'CA',
          jobType: 'retail',
          newDayCount: 3,
          newAverageJobCount: 50,
          oldDayRemoved: false,
        }),
      );
    });

    it('removes old day if windowStart is before threshold', async () => {
      mockGetAggregate.mockResolvedValueOnce({
        state: 'CA',
        jobType: 'retail',
        windowStart: oldTimestamp,
        totalJobCount: 200,
        dayCount: 4,
        averageJobCount: 50,
      });

      jest.spyOn(service as any, 'getOldDayJobCount').mockResolvedValue(25); // Applies to both calls

      await service.updateSlidingWindow('CA', 'retail', 100, baseTimestamp);

      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        'retail',
        100,
        baseTimestamp,
        oldTimestamp,
        25,
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Successfully updated Walmart sliding window:',
        expect.objectContaining({ oldDayRemoved: true }),
      );
    });

    it('handles missing old day job count gracefully', async () => {
      mockGetAggregate.mockResolvedValueOnce({
        state: 'CA',
        jobType: 'retail',
        windowStart: oldTimestamp,
        totalJobCount: 200,
        dayCount: 4,
        averageJobCount: 50,
      });

      jest
        .spyOn(service as any, 'getOldDayJobCount')
        .mockResolvedValue(undefined);

      await service.updateSlidingWindow('CA', 'retail', 100, baseTimestamp);

      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        'retail',
        100,
        baseTimestamp,
        undefined,
        undefined,
      );
    });

    it('logs and throws on update error', async () => {
      mockGetAggregate.mockRejectedValueOnce(new Error('fail'));

      await expect(
        service.updateSlidingWindow('CA', 'retail', 100, baseTimestamp),
      ).rejects.toThrow('fail');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update Walmart sliding window',
        expect.objectContaining({
          error: 'fail',
          state: 'CA',
          jobType: 'retail',
          newDayJobCount: 100,
          newDayTimestamp: baseTimestamp,
        }),
      );
    });

    it('handles non-Error thrown object during update', async () => {
      mockGetAggregate.mockRejectedValueOnce('some string');

      await expect(
        service.updateSlidingWindow('CA', 'retail', 10, baseTimestamp),
      ).rejects.toBe('some string');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update Walmart sliding window',
        expect.objectContaining({
          error: 'some string',
        }),
      );
    });
  });

  describe('getSlidingWindowScores', () => {
    it('returns correct scores for states', async () => {
      mockGetAggregate.mockImplementation(async (state: string) => {
        if (state === 'CA') return { averageJobCount: 99.6 };
        if (state === 'TX') return { averageJobCount: 50.3 };
        return undefined;
      });

      const result = await service.getSlidingWindowScores('retail');

      expect(result.CA).toBe(100);
      expect(result.TX).toBe(50);
      expect(result.NY).toBe(0);
    });

    it('logs and throws on error', async () => {
      mockGetAggregate.mockRejectedValueOnce(new Error('fail'));

      await expect(service.getSlidingWindowScores('retail')).rejects.toThrow(
        'fail',
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get Walmart sliding window scores',
        expect.objectContaining({
          error: 'fail',
          jobType: 'retail',
        }),
      );
    });

    it('handles thrown non-Error during score retrieval', async () => {
      mockGetAggregate.mockRejectedValueOnce(null);

      await expect(service.getSlidingWindowScores('retail')).rejects.toBe(null);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get Walmart sliding window scores',
        { error: 'null', jobType: 'retail' },
      );
    });
  });

  describe('getOldDayJobCount', () => {
    it('returns undefined and logs warning on error', async () => {
      const service = new WalmartSlidingWindowService();
      const result = await (service as any).getOldDayJobCount(
        'CA',
        'retail',
        1234,
      );
      expect(result).toBe(undefined);
    });
  });
});
