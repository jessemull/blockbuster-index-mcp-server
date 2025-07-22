import { AmazonSlidingWindowService } from './amazon-sliding-window-service';

describe('AmazonSlidingWindowService', () => {
  let mockGetAggregate: jest.Mock;
  let mockUpdateAggregate: jest.Mock;
  let mockSaveAggregate: jest.Mock;
  let mockQuery: jest.Mock;
  let mockGetOldDayJobCount: jest.Mock;
  let windowRepository: any;
  let jobRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAggregate = jest.fn();
    mockUpdateAggregate = jest.fn();
    mockSaveAggregate = jest.fn();
    mockQuery = jest.fn();
    mockGetOldDayJobCount = jest.fn();
    windowRepository = {
      getAggregate: mockGetAggregate,
      updateAggregate: mockUpdateAggregate,
      saveAggregate: mockSaveAggregate,
    };
    jobRepository = {
      query: mockQuery,
    };
  });

  describe('updateSlidingWindow', () => {
    it('creates initial aggregate if none exists', async () => {
      mockGetAggregate.mockResolvedValueOnce(undefined);
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
      });
      await service.updateSlidingWindow('CA', 100, 1234567890000);
      expect(mockSaveAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
          windowStart: 1234567890000,
          windowEnd: 1234567890000,
          totalJobCount: 100,
          dayCount: 1,
          averageJobCount: 100,
        }),
      );
      expect(mockUpdateAggregate).not.toHaveBeenCalled();
      expect(mockGetOldDayJobCount).not.toHaveBeenCalled();
    });

    it('updates aggregate and removes oldest day if needed', async () => {
      mockGetAggregate.mockResolvedValueOnce({ windowStart: 1000000000000 });
      // Simulate old day job count not found (undefined)
      mockGetOldDayJobCount.mockResolvedValueOnce(undefined);
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
      });
      await service.updateSlidingWindow('CA', 200, 1234567890000);
      expect(mockGetOldDayJobCount).toHaveBeenCalledWith('CA', 1000000000000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        200,
        1234567890000,
        undefined,
        undefined,
      );
      expect(mockSaveAggregate).not.toHaveBeenCalled();
    });

    it('updates aggregate without removing oldest day if not needed', async () => {
      mockGetAggregate.mockResolvedValueOnce({ windowStart: 1234567880000 });
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
      });
      await service.updateSlidingWindow('CA', 150, 1234567890000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        150,
        1234567890000,
        undefined,
        undefined,
      );
      expect(mockSaveAggregate).not.toHaveBeenCalled();
      expect(mockGetOldDayJobCount).not.toHaveBeenCalled();
    });

    it('handles case where old day record is not found', async () => {
      mockGetAggregate.mockResolvedValueOnce({ windowStart: 1000000000000 });
      mockGetOldDayJobCount.mockResolvedValueOnce(undefined);
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
      });
      await service.updateSlidingWindow('CA', 200, 1234567890000);
      expect(mockGetOldDayJobCount).toHaveBeenCalledWith('CA', 1000000000000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        200,
        1234567890000,
        undefined,
        undefined,
      );
      expect(mockSaveAggregate).not.toHaveBeenCalled();
    });

    it('handles errors during update', async () => {
      mockGetAggregate.mockRejectedValueOnce(new Error('Database error'));
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
      });
      await expect(
        service.updateSlidingWindow('CA', 100, 1234567890000),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getSlidingWindowScores', () => {
    it('returns scores for all states with data', async () => {
      const mockAggregates = {
        CA: { dayCount: 5, averageJobCount: 100 },
        TX: { dayCount: 3, averageJobCount: 50 },
        NY: { dayCount: 0, averageJobCount: 0 },
      };
      mockGetAggregate.mockImplementation(async (state: string) => {
        if (state === 'CA') return mockAggregates.CA;
        if (state === 'TX') return mockAggregates.TX;
        if (state === 'NY') return mockAggregates.NY;
        return null;
      });
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
        states: ['CA', 'TX', 'NY'],
      });
      const scores = await service.getSlidingWindowScores();
      expect(scores.CA).toBe(100);
      expect(scores.TX).toBe(50);
      expect(scores.NY).toBe(0);
    });

    it('returns zero for states with no aggregate', async () => {
      mockGetAggregate.mockResolvedValue(null);
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
        states: ['CA'],
      });
      const scores = await service.getSlidingWindowScores();
      expect(scores.CA).toBe(0);
    });

    it('handles errors during score retrieval', async () => {
      mockGetAggregate.mockRejectedValue(new Error('Database error'));
      const service = new AmazonSlidingWindowService({
        windowRepository,
        jobRepository,
        getOldDayJobCount: mockGetOldDayJobCount,
        states: ['CA'],
      });
      await expect(service.getSlidingWindowScores()).rejects.toThrow(
        'Database error',
      );
    });
  });
});
