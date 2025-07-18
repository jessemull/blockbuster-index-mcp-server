import { getAmazonScores } from '../../signals/amazon/get-amazon-scores';
import { logger } from '../../util';
import { States } from '../../types';
import type { JobSignalRecord, SignalRepository } from '../../types/amazon';

export class AmazonSignalService {
  private repository: SignalRepository<JobSignalRecord>;

  constructor(repository: SignalRepository<JobSignalRecord>) {
    this.repository = repository;
  }

  async collectAndStoreSignals(): Promise<void> {
    const timestamp = this.getStartOfDayTimestamp();

    try {
      logger.info('Starting Amazon signal collection and storage', {
        timestamp,
        totalStates: Object.keys(States).length,
      });

      const jobScores = await getAmazonScores();

      logger.info(
        'Successfully completed Amazon signal collection and storage',
        {
          timestamp,
          totalJobs: Object.values(jobScores).reduce(
            (sum: number, count: number) => sum + count,
            0,
          ),
          totalStates: Object.keys(jobScores).length,
        },
      );
    } catch (error: unknown) {
      logger.error('Failed to collect and store Amazon signals', {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  async getSignalsForDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<JobSignalRecord[]> {
    const endTimestamp = this.getStartOfDayTimestamp(endDate);
    const startTimestamp = this.getStartOfDayTimestamp(startDate);

    try {
      const records: JobSignalRecord[] = [];

      // Query each state for the date range...

      for (const state of Object.values(States)) {
        if (this.repository.query) {
          const stateRecords = await this.repository.query(
            state,
            startTimestamp,
            endTimestamp,
          );
          records.push(...stateRecords);
        } else {
          throw new Error('Query method not implemented for this repository');
        }
      }

      logger.info('Retrieved Amazon signal records for date range', {
        endDate: endDate.toISOString(),
        recordCount: records.length,
        startDate: startDate.toISOString(),
      });

      return records;
    } catch (error: unknown) {
      logger.error('Failed to retrieve Amazon signals for date range', {
        endDate: endDate.toISOString(),
        error: error instanceof Error ? error.message : String(error),
        startDate: startDate.toISOString(),
      });
      throw error;
    }
  }

  private getStartOfDayTimestamp(date: Date = new Date()): number {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds
  }
}
