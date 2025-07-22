import { States } from '../../types';
import { DynamoDBWalmartSlidingWindowRepository } from '../../repositories/walmart/walmart-sliding-window-repository';
import { DynamoDBWalmartJobRepository } from '../../repositories/walmart/walmart-physical-repository';
import { SlidingWindowService } from '../../services/generic-sliding-window-service';
import { WalmartSlidingWindowAggregate } from '../../types/walmart';

export class WalmartSlidingWindowService {
  service: SlidingWindowService<WalmartSlidingWindowAggregate>;

  constructor() {
    const windowRepository = new DynamoDBWalmartSlidingWindowRepository(
      process.env.WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-walmart-sliding-window-dev',
    );
    const jobRepository = new DynamoDBWalmartJobRepository(
      process.env.WALMART_DYNAMODB_TABLE_NAME ||
        'blockbuster-index-walmart-jobs-dev',
    );
    const getOldDayJobCount = async (
      state: string,
      timestamp: number,
    ): Promise<number | undefined> => {
      const record = await jobRepository.get(state, timestamp);
      if (record && typeof record.jobCount === 'number') {
        return record.jobCount;
      }
      return undefined;
    };
    this.service = new SlidingWindowService<WalmartSlidingWindowAggregate>({
      windowRepository,
      jobRepository,
      getOldDayJobCount,
      states: Object.values(States),
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
