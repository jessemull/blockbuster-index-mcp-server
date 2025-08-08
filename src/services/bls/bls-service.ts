import { logger } from '../../util';
import {
  detectAndCorrectOutliers,
  logOutlierAnalysis,
} from '../../util/helpers';
import type {
  BlsProcessedFile,
  BlsService as IBlsService,
  BlsSignalRecord,
  BlsStateData,
} from '../../types/bls';
import { DynamoDBBlsRepository } from '../../repositories/bls/bls-repository';
import { S3BlsLoader } from './s3-bls-loader';
import { calculateTrendSlope } from './calculate-trend-slope';
import { determineTrendCategory } from './determine-trend-category';
import { extractCombinedRetailDataFromCsv } from './extract-combined-retail-data';
import { validateStateData } from './validate-state-data';

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
    try {
      // Check if this year has already been processed...

      const isProcessed = await this.repository.isFileProcessed(year);
      if (isProcessed) {
        logger.info(`Year ${year} already processed, skipping`);
        return;
      }

      logger.info(`Processing BLS data for year ${year}`);

      // Process the CSV file in chunks to manage memory...

      const fileSize = await this.s3Loader.getFileSize(year);
      let totalRecords = 0;
      let validRecords = 0;

      // Track processed states at the year level to avoid duplicates...

      const processedStates = new Set<string>();

      // Aggregate data by state - combine brick and mortar and e-commerce...

      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      // Process CSV in chunks of 10,000 records...

      for await (const chunk of this.s3Loader.processCsvInChunks(year, 10000)) {
        totalRecords += chunk.length;

        // Extract combined retail data from this chunk...

        const combinedData = extractCombinedRetailDataFromCsv(
          chunk,
          parseInt(year, 10),
        );

        // Combine data by state...

        for (const data of combinedData) {
          if (!stateAggregatedData[data.state]) {
            stateAggregatedData[data.state] = {
              brickAndMortarCodes: {},
              ecommerceCodes: {},
            };
          }

          // Merge the code mappings...

          Object.assign(
            stateAggregatedData[data.state].brickAndMortarCodes,
            data.brickAndMortarCodes,
          );
          Object.assign(
            stateAggregatedData[data.state].ecommerceCodes,
            data.ecommerceCodes,
          );
        }

        // Log progress for large files...

        if (fileSize > 100 * 1024 * 1024) {
          logger.info(
            `Processed ${totalRecords} records for year ${year} (${Object.keys(stateAggregatedData).length} states so far)`,
          );
        }
      }

      // Save combined data for each state...

      const stateDataToSave: BlsStateData[] = [];

      for (const [state, aggregatedData] of Object.entries(
        stateAggregatedData,
      )) {
        const combinedRecord: BlsStateData = {
          state,
          year: parseInt(year, 10),
          timestamp: Math.floor(Date.now() / 1000),
          brickAndMortarCodes: aggregatedData.brickAndMortarCodes,
          ecommerceCodes: aggregatedData.ecommerceCodes,
        };

        if (validateStateData(combinedRecord)) {
          stateDataToSave.push(combinedRecord);
          validRecords++;
          processedStates.add(state);
        }
      }

      // Save all state data in batches for better performance...

      if (stateDataToSave.length > 0) {
        await this.repository.saveStateDataBatch(stateDataToSave);
        logger.info(`Saved ${stateDataToSave.length} state records in batches`);
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
    try {
      logger.info('Calculating BLS signals for all states...');

      // Get all unique states...

      const states = await this.repository.getAllUniqueStates();
      logger.info(`Found ${states.length} states to process`);

      if (states.length === 0) {
        logger.warn('No states found for signal calculation');
        return;
      }

      // Calculate signals for all states and collect slopes for normalization...

      const stateSignals: Array<{
        state: string;
        physicalSlope: number;
        ecommerceSlope: number;
        physicalTrend: 'declining' | 'stable' | 'growing';
        ecommerceTrend: 'declining' | 'stable' | 'growing';
        dataPoints: number;
        yearsAnalyzed: number[];
      }> = [];

      // Process states in batches to avoid memory issues...

      const batchSize = 5;
      const batches = Math.ceil(states.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = states.slice(i * batchSize, (i + 1) * batchSize);
        logger.info(
          `Processing batch ${i + 1}/${batches} (${batch.length} states)`,
        );

        const batchPromises = batch.map(async (state) => {
          try {
            logger.info(`Processing signal for state ${state}...`);
            const stateData =
              await this.repository.getAllStateDataForState(state);

            if (!stateData || stateData.length === 0) {
              logger.warn(`No state data found for ${state}`);
              return null;
            }

            // Sort by year...

            const sortedData = stateData.sort((a, b) => a.year - b.year);

            // Calculate physical retail signal using weighted approach (same as ecommerce)...

            const physicalCodeSlopes: Array<{
              slope: number;
              dataPoints: number;
            }> = [];
            let totalPhysicalDataPoints = 0;

            // Get all unique physical retail codes for this state...

            const allPhysicalCodes = new Set<string>();
            for (const data of sortedData) {
              Object.keys(data.brickAndMortarCodes).forEach((code) => {
                if (data.brickAndMortarCodes[code] > 0) {
                  allPhysicalCodes.add(code);
                }
              });
            }

            // Calculate individual slopes for each physical retail code...

            for (const code of allPhysicalCodes) {
              const codeDataPoints: { year: number; retailLq: number }[] = [];

              for (const data of sortedData) {
                if (
                  data.brickAndMortarCodes[code] &&
                  data.brickAndMortarCodes[code] > 0
                ) {
                  codeDataPoints.push({
                    year: data.year,
                    retailLq: data.brickAndMortarCodes[code],
                  });
                }
              }

              if (codeDataPoints.length >= 2) {
                const codeSlope = calculateTrendSlope(codeDataPoints);
                physicalCodeSlopes.push({
                  slope: codeSlope,
                  dataPoints: codeDataPoints.length,
                });
                totalPhysicalDataPoints += codeDataPoints.length;
              }
            }

            let physicalSlope = 0;
            let physicalTrend: 'declining' | 'stable' | 'growing' = 'stable';

            if (physicalCodeSlopes.length > 0) {
              // Calculate weighted average slope...

              const weightedSum = physicalCodeSlopes.reduce(
                (sum, codeData) => sum + codeData.slope * codeData.dataPoints,
                0,
              );
              physicalSlope = weightedSum / totalPhysicalDataPoints;
              physicalTrend = determineTrendCategory(physicalSlope);
            }

            // Calculate e-commerce signal using weighted approach...

            const ecommerceCodeSlopes: Array<{
              slope: number;
              dataPoints: number;
            }> = [];
            let totalDataPoints = 0;

            // Get all unique e-commerce codes for this state...

            const allEcommerceCodes = new Set<string>();
            for (const data of sortedData) {
              Object.keys(data.ecommerceCodes).forEach((code) => {
                if (data.ecommerceCodes[code] > 0) {
                  allEcommerceCodes.add(code);
                }
              });
            }

            // Calculate individual slopes for each e-commerce code...

            for (const code of allEcommerceCodes) {
              const codeDataPoints: { year: number; retailLq: number }[] = [];

              for (const data of sortedData) {
                if (
                  data.ecommerceCodes[code] &&
                  data.ecommerceCodes[code] > 0
                ) {
                  codeDataPoints.push({
                    year: data.year,
                    retailLq: data.ecommerceCodes[code],
                  });
                }
              }

              if (codeDataPoints.length >= 2) {
                const codeSlope = calculateTrendSlope(codeDataPoints);
                ecommerceCodeSlopes.push({
                  slope: codeSlope,
                  dataPoints: codeDataPoints.length,
                });
                totalDataPoints += codeDataPoints.length;
              }
            }

            let ecommerceSlope = 0;
            let ecommerceTrend: 'declining' | 'stable' | 'growing' = 'stable';

            if (ecommerceCodeSlopes.length > 0) {
              // Calculate weighted average slope...

              const weightedSum = ecommerceCodeSlopes.reduce(
                (sum, codeData) => sum + codeData.slope * codeData.dataPoints,
                0,
              );
              ecommerceSlope = weightedSum / totalDataPoints;
              ecommerceTrend = determineTrendCategory(ecommerceSlope);
            }

            return {
              state,
              physicalSlope,
              ecommerceSlope,
              physicalTrend,
              ecommerceTrend,
              dataPoints: totalPhysicalDataPoints,
              yearsAnalyzed: sortedData.map((d) => d.year),
            };
          } catch (error) {
            logger.error(`Error calculating signal for state ${state}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((result) => result !== null);
        stateSignals.push(...validResults);

        logger.info(`Processed ${batch.length} states`);

        // Add a small delay between batches to prevent throttling...

        if (i < batches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Normalize slopes using z-score across all states...

      const physicalSlopes = stateSignals.map((s) => s.physicalSlope);
      const ecommerceSlopes = stateSignals.map((s) => s.ecommerceSlope);

      const physicalMean =
        physicalSlopes.reduce((sum, slope) => sum + slope, 0) /
        physicalSlopes.length;
      const ecommerceMean =
        ecommerceSlopes.reduce((sum, slope) => sum + slope, 0) /
        ecommerceSlopes.length;

      const physicalStd = Math.sqrt(
        physicalSlopes.reduce(
          (sum, slope) => sum + Math.pow(slope - physicalMean, 2),
          0,
        ) / physicalSlopes.length,
      );
      const ecommerceStd = Math.sqrt(
        ecommerceSlopes.reduce(
          (sum, slope) => sum + Math.pow(slope - ecommerceMean, 2),
          0,
        ) / ecommerceSlopes.length,
      );

      logger.info(
        `Normalization stats: Physical mean=${physicalMean.toFixed(4)}, std=${physicalStd.toFixed(4)}`,
      );
      logger.info(
        `Normalization stats: E-commerce mean=${ecommerceMean.toFixed(4)}, std=${ecommerceStd.toFixed(4)}`,
      );

      // Calculate normalized scores and save signals...

      for (const signal of stateSignals) {
        try {
          // Calculate z-scores...

          const physicalZScore =
            (signal.physicalSlope - physicalMean) / physicalStd;
          const ecommerceZScore =
            (signal.ecommerceSlope - ecommerceMean) / ecommerceStd;

          // Invert physical retail signal (decline = higher score)...

          const physicalComponent = -physicalZScore;
          const ecommerceComponent = ecommerceZScore;

          // Convert to 0-100 scale...

          const physicalScore = Math.max(
            0,
            Math.min(100, 50 + physicalComponent * 15),
          );
          const ecommerceScore = Math.max(
            0,
            Math.min(100, 50 + ecommerceComponent * 15),
          );

          const signalRecord: BlsSignalRecord = {
            state: signal.state,
            timestamp: Math.floor(Date.now() / 1000),
            calculatedAt: new Date().toISOString(),
            physicalSlope: signal.physicalSlope,
            physicalTrend: signal.physicalTrend,
            ecommerceSlope: signal.ecommerceSlope,
            ecommerceTrend: signal.ecommerceTrend,
            physicalScore,
            ecommerceScore,
            dataPoints: signal.dataPoints,
            yearsAnalyzed: signal.yearsAnalyzed,
          };

          await this.repository.saveSignal(signalRecord);

          logger.info(
            `Calculated signal for ${signal.state}: physicalScore=${physicalScore.toFixed(2)} (${signal.dataPoints} points, ${signal.yearsAnalyzed.length} years), ecommerceScore=${ecommerceScore.toFixed(2)}`,
          );
        } catch (error) {
          logger.error(`Error saving signal for ${signal.state}:`, error);
        }
      }

      logger.info(`Calculated signals for ${stateSignals.length} states`);
    } catch (error) {
      logger.error('Error calculating all signals:', error);
      throw error;
    }
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
