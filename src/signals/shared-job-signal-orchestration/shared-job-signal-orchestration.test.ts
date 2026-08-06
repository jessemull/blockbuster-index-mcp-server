import { orchestrateSignal } from './shared-job-signal-orchestration';

describe('orchestrateSignal', () => {
  it('should update the sliding window and return sliding-window scores', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const updateSlidingWindow = jest.fn();
    const getSlidingWindowScores = jest
      .fn()
      .mockResolvedValue({ CA: 12, TX: 34 });

    const result = await orchestrateSignal({
      scraper: async () => ({ CA: 1, TX: 2 }),
      slidingWindowService: {
        updateSlidingWindow,
        getSlidingWindowScores,
      },
      getWorkforceData: async () => ({ CA: 100, TX: 200 }),
      normalizeScores: (jobs, workforce) => ({
        CA: jobs.CA / workforce.CA,
        TX: jobs.TX / workforce.TX,
      }),
      timestamp: 1_700_000_000,
      logger,
    });

    expect(updateSlidingWindow).toHaveBeenCalledWith('CA', 1, 1_700_000_000);
    expect(updateSlidingWindow).toHaveBeenCalledWith('TX', 2, 1_700_000_000);
    expect(result).toEqual({ CA: 12, TX: 34 });
    expect(logger.info).toHaveBeenCalled();
  });
});
