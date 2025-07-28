import { logger } from '../../util';
import type {
  BlsMetrics,
  BlsProcessedFile,
  BlsStateData,
  BlsSignalRecord,
  BlsService as IBlsService,
} from '../../types/bls';
import { DynamoDBBlsRepository } from '../../repositories/bls/bls-repository';
import { S3BlsLoader } from './s3-bls-loader';
import {
  extractRetailDataFromCsv,
  calculateTrendSlope,
  determineTrendCategory,
  calculateBlockbusterScore,
  validateStateData,
  sortStateDataByYear,
} from './bls-data-processor';

export class BlsService implements IBlsService {
  private repository: DynamoDBBlsRepository;
  private s3Loader: S3BlsLoader;

  constructor(repository?: DynamoDBBlsRepository) {
    this.repository =
      repository ||
      new DynamoDBBlsRepository(
        process.env.BLS_PROCESSED_FILES_TABLE_NAME ||
          'blockbuster-index-bls-processed-files-dev',
        process.env.BLS_STATE_DATA_TABLE_NAME ||
          'blockbuster-index-bls-state-data-dev',
        process.env.BLS_SIGNALS_TABLE_NAME ||
          'blockbuster-index-bls-signals-dev',
      );
    this.s3Loader = new S3BlsLoader(
      process.env.BLS_S3_BUCKET || 'blockbuster-index-bls-dev',
    );
  }

  async processBlsData(): Promise<void> {
    logger.info('Starting BLS data processing from S3...');

    try {
      const availableYears = await this.s3Loader.listAvailableYears();
      logger.info(`Found ${availableYears.length} years of BLS data available`);

      for (const year of availableYears) {
        await this.processYearData(year);
      }

      // After processing all years, calculate signals for all states...

      await this.calculateAllSignals();

      logger.info('BLS data processing completed');
    } catch (error) {
      logger.error('Error in BLS data processing:', error);
      throw error;
    }
  }

  private async processYearData(year: string): Promise<void> {
    logger.info(`Processing BLS data for year ${year}`);

    try {
      // Check if this year has already been processed...

      const isProcessed = await this.repository.isFileProcessed(year);
      if (isProcessed) {
        logger.info(`Year ${year} already processed, skipping`);
        return;
      }

      // Download and parse the CSV file...

      const csvRecords = await this.s3Loader.downloadAndParseCsv(year);
      const fileSize = await this.s3Loader.getFileSize(year);

      // Extract retail data from the CSV...

      const stateData = extractRetailDataFromCsv(
        csvRecords,
        parseInt(year, 10),
      );

      // Validate and save state data...

      let validRecords = 0;
      for (const data of stateData) {
        if (validateStateData(data)) {
          await this.repository.saveStateData(data);
          validRecords++;
        }
      }

      // Mark the file as processed...

      const processedFile: BlsProcessedFile = {
        year,
        processedAt: Math.floor(Date.now() / 1000),
        fileSize,
        recordCount: validRecords,
      };

      await this.repository.saveProcessedFile(processedFile);

      logger.info(
        `Successfully processed year ${year}: ${validRecords} valid state records`,
      );
    } catch (error) {
      logger.error(`Failed to process year ${year}:`, error);
      throw error;
    }
  }

  private async calculateAllSignals(): Promise<void> {
    logger.info('Calculating BLS signals for all states...');

    try {
      // Get all available years from the repository...

      const years = await this.getAvailableYears();
      if (years.length === 0) {
        logger.warn('No years available for signal calculation');
        return;
      }

      // Process state data in chunks to avoid memory issues...

      const stateDataMap = new Map<string, BlsStateData[]>();

      for (const year of years) {
        logger.info(`Processing state data for year ${year}...`);
        const yearData = await this.repository.getAllStateDataForYear(year);

        // Group by state as we process each year...

        for (const data of yearData) {
          if (!stateDataMap.has(data.state)) {
            stateDataMap.set(data.state, []);
          }
          stateDataMap.get(data.state)!.push(data);
        }

        // Memory management: log progress...

        logger.info(
          `Processed year ${year}: ${yearData.length} records, total states: ${stateDataMap.size}`,
        );
      }

      // Calculate signals for each state...

      let processedStates = 0;
      for (const [state, stateData] of stateDataMap) {
        await this.calculateStateSignal(state, stateData);
        processedStates++;

        // Log progress every 10 states...

        if (processedStates % 10 === 0) {
          logger.info(
            `Processed ${processedStates}/${stateDataMap.size} states`,
          );
        }
      }

      logger.info(`Calculated signals for ${processedStates} states`);
    } catch (error) {
      logger.error('Error calculating signals:', error);
      throw error;
    }
  }

  private async calculateStateSignal(
    state: string,
    stateData: BlsStateData[],
  ): Promise<void> {
    try {
      // Sort data by year...

      const sortedData = sortStateDataByYear(stateData);

      if (sortedData.length < 2) {
        logger.warn(
          `Insufficient data for state ${state}: ${sortedData.length} data points`,
        );
        return;
      }

      // Calculate trend slope...

      const dataPoints = sortedData.map((d) => ({
        year: d.year,
        retailLq: d.retailLq,
      }));
      const slope = calculateTrendSlope(dataPoints);
      const trend = determineTrendCategory(slope);
      const blockbusterScore = calculateBlockbusterScore(slope, trend);

      // Create signal record...

      const signalRecord: BlsSignalRecord = {
        state,
        timestamp: Math.floor(Date.now() / 1000),
        calculatedAt: new Date().toISOString(),
        retailLqSlope: slope,
        retailLqTrend: trend,
        blockbusterScore,
        dataPoints: sortedData.length,
        yearsAnalyzed: sortedData.map((d) => d.year),
      };

      await this.repository.saveSignal(signalRecord);

      logger.info(
        `Calculated signal for ${state}: score=${blockbusterScore}, trend=${trend}, slope=${slope}`,
      );
    } catch (error) {
      logger.error(`Error calculating signal for state ${state}:`, error);
      throw error;
    }
  }

  async calculateStateMetrics(state: string): Promise<BlsMetrics | null> {
    try {
      const latestSignal = await this.repository.getLatestSignal(state);
      if (!latestSignal) {
        return null;
      }

      return {
        retailLqSlope: latestSignal.retailLqSlope,
        retailLqTrend: latestSignal.retailLqTrend,
        blockbusterScore: latestSignal.blockbusterScore,
        dataPoints: latestSignal.dataPoints,
        yearsAnalyzed: latestSignal.yearsAnalyzed,
      };
    } catch (error) {
      logger.error(`Error calculating metrics for state ${state}:`, error);
      throw error;
    }
  }

  async getAllScores(): Promise<Record<string, number>> {
    try {
      const signals = await this.repository.getAllSignals();
      const scores: Record<string, number> = {};

      for (const signal of signals) {
        scores[signal.state] = signal.blockbusterScore;
      }

      logger.info(`Retrieved scores for ${Object.keys(scores).length} states`);
      return scores;
    } catch (error) {
      logger.error('Error getting all scores:', error);
      throw error;
    }
  }

  private async getAvailableYears(): Promise<number[]> {
    try {
      // Get all processed files to determine available years...

      const years: number[] = [];
      const availableYears = await this.s3Loader.listAvailableYears();

      for (const year of availableYears) {
        const isProcessed = await this.repository.isFileProcessed(year);
        if (isProcessed) {
          years.push(parseInt(year, 10));
        }
      }

      return years.sort();
    } catch (error) {
      logger.error('Error getting available years:', error);
      throw error;
    }
  }
}
