import { States } from '../../types/states';
import { DynamoDBAmazonSlidingWindowRepository } from '../../repositories/amazon/amazon-sliding-window-repository';
import { DynamoDBAmazonSignalRepository } from '../../repositories/amazon/amazon-signal-repository';
import { SlidingWindowService } from '../../services/generic-sliding-window-service';
import { SlidingWindowAggregate } from '../../types/amazon';

export class AmazonSlidingWindowService {
  service: SlidingWindowService<SlidingWindowAggregate>;

  constructor() {
    const windowRepository = new DynamoDBAmazonSlidingWindowRepository(
      process.env.AMAZON_SLIDING_WINDOW_TABLE_NAME ||
        'blockbuster-index-amazon-sliding-window-dev',
    );
    const jobRepository = new DynamoDBAmazonSignalRepository(
      process.env.AMAZON_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-amazon-jobs-dev',
    );
    const getOldDayJobCount = async (
      state: string,
      timestamp: number,
    ): Promise<number | undefined> => {
      const records = await jobRepository.query(state, timestamp, timestamp);
      if (records && records.length > 0) {
        return records[0].jobCount;
      }
      return undefined;
    };
    this.service = new SlidingWindowService<SlidingWindowAggregate>({
      windowRepository,
      jobRepository,
      getOldDayJobCount,
      states: Object.values(States),
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
