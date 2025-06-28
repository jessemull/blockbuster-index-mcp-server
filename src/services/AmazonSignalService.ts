import { getAmazonScores } from '../signals/amazon';
import {
  JobSignalRecord,
  JobSignalRepository,
} from '../repositories/JobSignalRepository';
import { States } from '../types';
import { logger } from '../util';

export class AmazonSignalService {
  private repository: JobSignalRepository;

  constructor(repository: JobSignalRepository) {
    this.repository = repository;
  }

  async collectAndStoreSignals(): Promise<void> {
    const timestamp = this.getStartOfDayTimestamp();

    try {
      logger.info('Starting Amazon signal collection and storage', {
        timestamp,
        totalStates: Object.keys(States).length,
      });

      // Get Amazon job scores and store data while scraping
      const jobScores = await getAmazonScores(this.repository, timestamp);

      logger.info(
        'Successfully completed Amazon signal collection and storage',
        {
          timestamp,
          totalJobs: Object.values(jobScores).reduce(
            (sum, count) => sum + count,
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

      // Query each state for the date range
      for (const state of Object.values(States)) {
        const stateRecords = await this.repository.query(
          state,
          startTimestamp,
          endTimestamp,
        );
        records.push(...stateRecords);
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
    startOfDay.setHours(0, 0, 0, 0);
    return Math.floor(startOfDay.getTime() / 1000); // Unix timestamp in seconds
  }
}
