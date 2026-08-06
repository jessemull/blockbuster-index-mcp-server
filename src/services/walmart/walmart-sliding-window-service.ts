import { CONFIG } from '../../config';
import { DynamoDBWalmartJobRepository } from '../../repositories/walmart/walmart-physical-repository';
import { DynamoDBWalmartSlidingWindowRepository } from '../../repositories/walmart/walmart-sliding-window-repository';
import { SlidingWindowService } from '../../services/generic-sliding-window-service';
import { States } from '../../types';
import { WalmartSlidingWindowAggregate } from '../../types/walmart';

export class WalmartSlidingWindowService {
  service: SlidingWindowService<WalmartSlidingWindowAggregate>;

  constructor({
    windowRepository,
    jobRepository,
    getOldDayJobCount,
    states,
  }: {
    getOldDayJobCount?: (
      state: string,
      timestamp: number,
    ) => Promise<number | undefined>;
    jobRepository?: import('../../types/walmart').WalmartSignalRepository<
      import('../../types/walmart').WalmartJobRecord
    >;
    states?: string[];
    windowRepository?: import('../../types/walmart').WalmartSlidingWindowRepository;
  } = {}) {
    const region = CONFIG.AWS_REGION;
    const defaultWindowRepository = new DynamoDBWalmartSlidingWindowRepository(
      CONFIG.WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME,
      region,
    );
    const defaultJobRepository = new DynamoDBWalmartJobRepository(
      CONFIG.WALMART_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-walmart-jobs-dev',
      region,
    );
    const defaultGetOldDayJobCount = async (
      state: string,
      timestamp: number,
    ): Promise<number | undefined> => {
      const record = await (jobRepository || defaultJobRepository).get(
        state,
        timestamp,
      );
      if (record && typeof record.jobCount === 'number') {
        return record.jobCount;
      }
      return undefined;
    };
    this.service = new SlidingWindowService<WalmartSlidingWindowAggregate>({
      windowRepository: windowRepository || defaultWindowRepository,
      jobRepository: jobRepository || defaultJobRepository,
      getOldDayJobCount: getOldDayJobCount || defaultGetOldDayJobCount,
      states: states || Object.values(States),
    });
  }

  async updateSlidingWindow(
    state: string,
    newDayJobCount: number,
    newDayTimestamp: number,
  ) {
    return this.service.updateSlidingWindow(
      state,
      newDayJobCount,
      newDayTimestamp,
    );
  }

  async getSlidingWindowScores() {
    return this.service.getSlidingWindowScores();
  }
}
