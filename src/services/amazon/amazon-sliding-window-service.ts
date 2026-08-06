import { CONFIG } from '../../config';
import { DynamoDBAmazonSignalRepository } from '../../repositories/amazon/amazon-signal-repository';
import { DynamoDBAmazonSlidingWindowRepository } from '../../repositories/amazon/amazon-sliding-window-repository';
import { SlidingWindowService } from '../../services/generic-sliding-window-service';
import { SlidingWindowAggregate } from '../../types/amazon';
import { States } from '../../types/states';

export class AmazonSlidingWindowService {
  service: SlidingWindowService<SlidingWindowAggregate>;

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
    jobRepository?: import('../../types/repository').SignalRepository<
      import('../../types/amazon').JobSignalRecord
    >;
    states?: string[];
    windowRepository?: import('../../types/amazon').SlidingWindowRepository;
  } = {}) {
    const region = CONFIG.AWS_REGION;
    const defaultWindowRepository = new DynamoDBAmazonSlidingWindowRepository(
      CONFIG.AMAZON_SLIDING_WINDOW_TABLE_NAME,
      region,
    );
    const defaultJobRepository = new DynamoDBAmazonSignalRepository(
      CONFIG.AMAZON_DYNAMODB_TABLE_NAME || 'blockbuster-index-amazon-jobs-dev',
      region,
    );
    const defaultGetOldDayJobCount = async (
      state: string,
      timestamp: number,
    ): Promise<number | undefined> => {
      const repo = jobRepository || defaultJobRepository;
      if (repo.query) {
        const records = await repo.query(state, timestamp, timestamp);
        if (records && records.length > 0) {
          return records[0].jobCount;
        }
      }
      return undefined;
    };
    this.service = new SlidingWindowService<SlidingWindowAggregate>({
      windowRepository: windowRepository || defaultWindowRepository,
      jobRepository: jobRepository || defaultJobRepository,
      getOldDayJobCount: getOldDayJobCount || defaultGetOldDayJobCount,
      states: states || Object.values(States),
    });
  }

  async updateSlidingWindow(
    state: string,
    newJobCount: number,
    newTimestamp: number,
  ) {
    return this.service.updateSlidingWindow(state, newJobCount, newTimestamp);
  }

  async getSlidingWindowScores() {
    return this.service.getSlidingWindowScores();
  }
}
