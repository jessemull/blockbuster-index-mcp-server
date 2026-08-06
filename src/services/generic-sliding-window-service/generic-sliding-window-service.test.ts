import { SlidingWindowService } from './generic-sliding-window-service';

describe('SlidingWindowService', () => {
  const createService = () => {
    const windowRepository = {
      getAggregate: jest.fn(),
      saveAggregate: jest.fn(),
      updateAggregate: jest.fn(),
    };
    const getOldDayJobCount = jest.fn().mockResolvedValue(undefined);
    const service = new SlidingWindowService({
      windowRepository,
      jobRepository: {},
      getOldDayJobCount,
      states: ['CA'],
    });
    return { getOldDayJobCount, service, windowRepository };
  };

  it('should create a new aggregate when none exists', async () => {
    const { service, windowRepository } = createService();
    windowRepository.getAggregate.mockResolvedValue(null);

    await service.updateSlidingWindow('CA', 10, 1_700_000_000);

    expect(windowRepository.saveAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'CA',
        totalJobCount: 10,
        dayCount: 1,
        averageJobCount: 10,
      }),
    );
  });

  it('should return average job counts from aggregates', async () => {
    const { service, windowRepository } = createService();
    windowRepository.getAggregate.mockResolvedValue({
      state: 'CA',
      averageJobCount: 42,
      dayCount: 2,
      lastUpdated: 1,
      totalJobCount: 84,
      windowEnd: 2,
      windowStart: 1,
    });

    const scores = await service.getSlidingWindowScores();

    expect(scores).toEqual({ CA: 42 });
  });
});
