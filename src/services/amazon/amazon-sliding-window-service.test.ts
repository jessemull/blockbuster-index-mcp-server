import { AmazonSlidingWindowService } from './amazon-sliding-window-service';
import { logger } from '../../util';

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetAggregate = jest.fn();
const mockUpdateAggregate = jest.fn();
const mockQuery = jest.fn();
const mockSaveAggregate = jest.fn();

jest.mock('../../repositories/amazon/amazon-sliding-window-repository', () => {
  return {
    DynamoDBAmazonSlidingWindowRepository: jest.fn().mockImplementation(() => ({
      getAggregate: mockGetAggregate,
      updateAggregate: mockUpdateAggregate,
      saveAggregate: mockSaveAggregate,
    })),
  };
});

jest.mock('../../repositories/amazon/amazon-signal-repository', () => {
  return {
    DynamoDBAmazonSignalRepository: jest.fn().mockImplementation(() => ({
      query: mockQuery,
    })),
  };
});

describe('AmazonSlidingWindowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSlidingWindow', () => {
    it('creates initial aggregate if none exists', async () => {
      mockGetAggregate.mockResolvedValueOnce(undefined);
      const service = new AmazonSlidingWindowService();
      await service.updateSlidingWindow('CA', 100, 1234567890000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        100,
        1234567890000,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Updating sliding window for state:',
        expect.any(Object),
      );
    });

    it('updates aggregate and removes oldest day if needed', async () => {
      mockGetAggregate.mockResolvedValueOnce({ windowStart: 1000000000000 });
      mockQuery.mockResolvedValueOnce([{ jobCount: 50 }]);
      const service = new AmazonSlidingWindowService();
      await service.updateSlidingWindow('CA', 200, 1234567890000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        200,
        1234567890000,
        1000000000000,
        50,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully updated sliding window:',
        expect.any(Object),
      );
    });

    it('updates aggregate without removing oldest day if not needed', async () => {
      mockGetAggregate.mockResolvedValueOnce({ windowStart: 1234567880000 });
      const service = new AmazonSlidingWindowService();
      await service.updateSlidingWindow('CA', 150, 1234567890000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        150,
        1234567890000,
        undefined,
        undefined,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully updated sliding window:',
        expect.any(Object),
      );
    });

    it('handles case where old day record is not found', async () => {
      mockGetAggregate.mockResolvedValueOnce({ windowStart: 1000000000000 });
      mockQuery.mockResolvedValueOnce([]);
      const service = new AmazonSlidingWindowService();
      await service.updateSlidingWindow('CA', 200, 1234567890000);
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        200,
        1234567890000,
        1000000000000,
        undefined,
      );
    });

    it('handles errors during update', async () => {
      mockGetAggregate.mockRejectedValueOnce(new Error('Database error'));
      const service = new AmazonSlidingWindowService();
      await expect(
        service.updateSlidingWindow('CA', 100, 1234567890000),
      ).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update sliding window',
        expect.any(Object),
      );
    });
  });

  describe('getSlidingWindowScores', () => {
    it('returns scores for all states with data', async () => {
      const mockAggregates = {
        CA: { dayCount: 5, averageJobCount: 100 },
        TX: { dayCount: 3, averageJobCount: 50 },
        NY: { dayCount: 0, averageJobCount: 0 },
      };

      // Mock getAggregate to return different values for different states
      mockGetAggregate.mockImplementation((state: string) => {
        if (state === 'CA') return Promise.resolve(mockAggregates.CA);
        if (state === 'TX') return Promise.resolve(mockAggregates.TX);
        if (state === 'NY') return Promise.resolve(mockAggregates.NY);
        return Promise.resolve(null); // Default for other states
      });

      const service = new AmazonSlidingWindowService();
      const scores = await service.getSlidingWindowScores();

      expect(scores.CA).toBe(100);
      expect(scores.TX).toBe(50);
      expect(scores.NY).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        'Getting sliding window scores for all states',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Retrieved sliding window scores:',
        expect.any(Object),
      );
    });

    it('returns zero for states with no aggregate', async () => {
      mockGetAggregate.mockResolvedValue(null);
      const service = new AmazonSlidingWindowService();
      const scores = await service.getSlidingWindowScores();

      expect(scores.CA).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        'Retrieved sliding window scores:',
        expect.any(Object),
      );
    });

    it('handles errors during score retrieval', async () => {
      mockGetAggregate.mockRejectedValue(new Error('Database error'));
      const service = new AmazonSlidingWindowService();
      await expect(service.getSlidingWindowScores()).rejects.toThrow(
        'Database error',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get sliding window scores',
        expect.any(Object),
      );
    });
  });

  describe('initializeSlidingWindowFromHistoricalData', () => {
    it('initializes aggregates for states with historical data', async () => {
      const mockJobRecords = [
        { timestamp: 1234567890000, jobCount: 100 },
        { timestamp: 1234567891000, jobCount: 150 },
      ];
      mockQuery.mockResolvedValue(mockJobRecords);

      const service = new AmazonSlidingWindowService();
      await service.initializeSlidingWindowFromHistoricalData();

      expect(mockSaveAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
          totalJobCount: 250,
          dayCount: 2,
          averageJobCount: 125,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Initializing sliding window from historical data',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Completed sliding window initialization',
      );
    });

    it('skips states with no historical data', async () => {
      mockQuery.mockResolvedValue([]);

      const service = new AmazonSlidingWindowService();
      await service.initializeSlidingWindowFromHistoricalData();

      expect(mockSaveAggregate).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'No historical data found for CA',
      );
    });

    it('handles errors during initialization', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const service = new AmazonSlidingWindowService();
      await expect(
        service.initializeSlidingWindowFromHistoricalData(),
      ).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize sliding window',
        expect.any(Object),
      );
    });
  });
});
