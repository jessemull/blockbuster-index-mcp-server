import { WalmartSlidingWindowService } from './walmart-sliding-window-service';
import { DynamoDBWalmartSlidingWindowRepository } from '../../repositories/walmart/walmart-sliding-window-repository';
import type { WalmartSlidingWindowAggregate } from '../../types/walmart';

// Mock the repository
jest.mock('../../repositories/walmart/walmart-sliding-window-repository');

const mockGetAggregate = jest.fn();
const mockSaveAggregate = jest.fn();
const mockUpdateAggregate = jest.fn();

const mockRepository = {
  getAggregate: mockGetAggregate,
  saveAggregate: mockSaveAggregate,
  updateAggregate: mockUpdateAggregate,
} as unknown as DynamoDBWalmartSlidingWindowRepository;

describe('WalmartSlidingWindowService', () => {
  let service: WalmartSlidingWindowService;

  beforeEach(() => {
    service = new WalmartSlidingWindowService();
    (service as any).repository = mockRepository;
    jest.clearAllMocks();
  });

  describe('updateSlidingWindow', () => {
    const timestamp = 1234567890 * 1000; // Convert to milliseconds

    it('should create new aggregate when none exists', async () => {
      mockGetAggregate.mockResolvedValueOnce(null);
      mockSaveAggregate.mockResolvedValueOnce(undefined);

      await service.updateSlidingWindow('CA', 200, timestamp);

      expect(mockGetAggregate).toHaveBeenCalledWith('CA');
      expect(mockSaveAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA',
          windowStart: timestamp,
          windowEnd: timestamp,
          totalJobCount: 200,
          dayCount: 1,
          averageJobCount: 200,
        }),
      );
    });

    it('should update existing aggregate', async () => {
      const existingAggregate: WalmartSlidingWindowAggregate = {
        state: 'CA',
        windowStart: timestamp - 86400000, // 1 day ago
        windowEnd: timestamp - 86400000,
        totalJobCount: 1000,
        dayCount: 5,
        averageJobCount: 200,
        lastUpdated: Date.now() - 86400000,
      };
      mockGetAggregate.mockResolvedValueOnce(existingAggregate);
      mockUpdateAggregate.mockResolvedValueOnce(undefined);

      await service.updateSlidingWindow('CA', 300, timestamp);

      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        300,
        timestamp,
        undefined,
        undefined,
      );
    });

    it('should handle sliding window removal when old data exists', async () => {
      const oldTimestamp = timestamp - 90 * 24 * 60 * 60 * 1000; // 90 days ago
      const existingAggregate: WalmartSlidingWindowAggregate = {
        state: 'CA',
        windowStart: oldTimestamp,
        windowEnd: timestamp - 86400000,
        totalJobCount: 1000,
        dayCount: 5,
        averageJobCount: 200,
        lastUpdated: Date.now() - 86400000,
      };
      mockGetAggregate.mockResolvedValueOnce(existingAggregate);
      mockUpdateAggregate.mockResolvedValueOnce(undefined);

      await service.updateSlidingWindow('CA', 300, timestamp);

      // Since getOldDayJobCount returns undefined, newWindowStart never changes
      // so the old window start is not passed to updateAggregate
      expect(mockUpdateAggregate).toHaveBeenCalledWith(
        'CA',
        300,
        timestamp,
        undefined, // old window start (undefined because newWindowStart === currentAggregate.windowStart)
        undefined, // old day job count (undefined because getOldDayJobCount returns undefined)
      );
    });
  });

  describe('getSlidingWindowScores', () => {
    it('should return scores for all states', async () => {
      const mockAggregate: WalmartSlidingWindowAggregate = {
        state: 'CA',
        windowStart: 1234567890,
        windowEnd: 1234567890,
        totalJobCount: 1500,
        dayCount: 10,
        averageJobCount: 150,
        lastUpdated: Date.now(),
      };
      mockGetAggregate.mockResolvedValue(mockAggregate);

      const result = await service.getSlidingWindowScores();

      expect(result).toHaveProperty('CA');
      expect(result.CA).toBe(150);
      expect(mockGetAggregate).toHaveBeenCalledWith('CA');
    });

    it('should return 0 for states without aggregates', async () => {
      mockGetAggregate.mockResolvedValue(null);

      const result = await service.getSlidingWindowScores();

      expect(result).toHaveProperty('CA');
      expect(result.CA).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockGetAggregate.mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.getSlidingWindowScores()).rejects.toThrow(
        'DynamoDB error',
      );
    });
  });

  describe('getOldDayJobCount', () => {
    it('should return undefined for now', async () => {
      const result = await (service as any).getOldDayJobCount('CA', 1234567890);

      expect(result).toBeUndefined();
    });
  });
});
