export interface SignalOrchestrationParams<
  JobCounts,
  WorkforceData,
  SlidingWindowService,
> {
  getWorkforceData: () => Promise<WorkforceData>;
  logger: {
    error: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
  };
  normalizeScores: (
    jobCounts: JobCounts,
    workforceData: WorkforceData,
  ) => Record<string, number>;
  scraper: (timestamp: number) => Promise<JobCounts>;
  slidingWindowService: SlidingWindowService;
  timestamp: number;
}

export async function orchestrateSignal<
  JobCounts extends Record<string, number>,
  WorkforceData,
  SlidingWindowService extends {
    getSlidingWindowScores: () => Promise<Record<string, number>>;
    updateSlidingWindow: (
      state: string,
      jobCount: number,
      timestamp: number,
    ) => Promise<void>;
  },
>(
  params: SignalOrchestrationParams<
    JobCounts,
    WorkforceData,
    SlidingWindowService
  >,
): Promise<Record<string, number>> {
  const {
    scraper,
    slidingWindowService,
    getWorkforceData,
    normalizeScores,
    timestamp,
    logger,
  } = params;

  logger.info('Starting signal calculation with sliding window...');

  const jobCounts = await scraper(timestamp);
  const workforceData = await getWorkforceData();
  const normalizedScores = normalizeScores(jobCounts, workforceData);

  for (const state of Object.keys(jobCounts)) {
    await slidingWindowService.updateSlidingWindow(
      state,
      jobCounts[state],
      timestamp,
    );
  }

  const slidingWindowScores =
    await slidingWindowService.getSlidingWindowScores();

  logger.info('Signal calculation completed with workforce normalization...', {
    normalizedScores,
    slidingWindowScores,
  });

  return slidingWindowScores;
}
