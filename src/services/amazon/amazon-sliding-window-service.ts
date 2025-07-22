import { States } from '../../types/states';
import { DynamoDBAmazonSlidingWindowRepository } from '../../repositories/amazon/amazon-sliding-window-repository';
import { DynamoDBAmazonSignalRepository } from '../../repositories/amazon/amazon-signal-repository';
import { SlidingWindowService } from '../../services/generic-sliding-window-service';
import { SlidingWindowAggregate } from '../../types/amazon';

export class AmazonSlidingWindowService {
  service: SlidingWindowService<SlidingWindowAggregate>;

  constructor({
    windowRepository,
    jobRepository,
    getOldDayJobCount,
    states,
  }: {
    windowRepository?: import('../../types/amazon').SlidingWindowRepository;
    jobRepository?: import('../../types/amazon').SignalRepository<
      import('../../types/amazon').JobSignalRecord
    >;
    getOldDayJobCount?: (
      state: string,
      timestamp: number,
    ) => Promise<number | undefined>;
    states?: string[];
  } = {}) {
    const region = process.env.AWS_REGION || 'us-west-2';
    const defaultWindowRepository = new DynamoDBAmazonSlidingWindowRepository(
      process.env.AMAZON_SLIDING_WINDOW_TABLE_NAME ||
        'blockbuster-index-amazon-sliding-window-dev',
      region,
    );
    const defaultJobRepository = new DynamoDBAmazonSignalRepository(
      process.env.AMAZON_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-amazon-jobs-dev',
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
