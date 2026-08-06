import type { BlsService as IBlsService } from '../../types/bls';
import { CONFIG } from '../../config';
import { DynamoDBBlsRepository } from '../../repositories/bls/bls-repository';
import { logger } from '../../util';
import {
  detectAndCorrectOutliers,
  logOutlierAnalysis,
} from '../../util/helpers';
import { calculateAllSignals as calculateAllSignalsFn } from './calculate-bls-signals';
import { processYearData as processYearDataFn } from './process-year-data';
import { S3BlsLoader } from './s3-bls-loader';

export class BlsService implements IBlsService {
  private repository: DynamoDBBlsRepository;
  private s3Loader: S3BlsLoader;

  constructor(repository?: DynamoDBBlsRepository) {
    this.repository =
      repository ||
      new DynamoDBBlsRepository(
        CONFIG.BLS_PROCESSED_FILES_TABLE_NAME,
        CONFIG.BLS_STATE_DATA_TABLE_NAME,
        CONFIG.BLS_SIGNALS_TABLE_NAME,
      );
    this.s3Loader = new S3BlsLoader(CONFIG.BLS_S3_BUCKET);
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
    await processYearDataFn(year, this.repository, this.s3Loader);
  }

  private async calculateAllSignals(): Promise<void> {
    await calculateAllSignalsFn(this.repository);
  }

  async getAllPhysicalScores(): Promise<Record<string, number>> {
    try {
      const signals = await this.repository.getAllSignals();
      const scores: Record<string, number> = {};

      for (const signal of signals) {
        scores[signal.state] = signal.physicalScore;
      }

      // Apply outlier detection and correction...

      const outlierAnalysis = detectAndCorrectOutliers(scores);
      logOutlierAnalysis(outlierAnalysis, 'physical');

      if (outlierAnalysis.outliers.length > 0) {
        logger.info(
          `Corrected ${outlierAnalysis.outliers.length} physical score outliers: ${outlierAnalysis.outliers.join(', ')}`,
        );
      }

      logger.info(
        `Retrieved physical scores for ${Object.keys(outlierAnalysis.correctedScores).length} states`,
      );

      return outlierAnalysis.correctedScores;
    } catch (error) {
      logger.error('Error getting physical scores:', error);
      throw error;
    }
  }

  async getAllEcommerceScores(): Promise<Record<string, number>> {
    try {
      const signals = await this.repository.getAllSignals();
      const scores: Record<string, number> = {};

      for (const signal of signals) {
        scores[signal.state] = signal.ecommerceScore;
      }

      logger.info(
        `Retrieved ecommerce scores for ${Object.keys(scores).length} states`,
      );
      return scores;
    } catch (error) {
      logger.error('Error getting ecommerce scores:', error);
      throw error;
    }
  }
}
