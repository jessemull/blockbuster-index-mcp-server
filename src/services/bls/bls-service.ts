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
  extractCombinedRetailDataFromCsv,
  testSingleStateProcessing,
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

      // Track processed states at the year level to avoid duplicates
      const processedStates = new Set<string>();

      // Aggregate data by state - combine brick and mortar and e-commerce
      const stateAggregatedData: Record<
        string,
        {
          brickAndMortarCodes: Record<string, number>;
          ecommerceCodes: Record<string, number>;
        }
      > = {};

      // Process CSV in chunks of 10,000 records
      for await (const chunk of this.s3Loader.processCsvInChunks(year, 10000)) {
        totalRecords += chunk.length;

        // Extract combined retail data from this chunk...
        const combinedData = extractCombinedRetailDataFromCsv(
          chunk,
          parseInt(year, 10),
        );

        // Combine data by state
        for (const data of combinedData) {
          if (!stateAggregatedData[data.state]) {
            stateAggregatedData[data.state] = {
              brickAndMortarCodes: {},
              ecommerceCodes: {},
            };
          }

          // Merge the code mappings
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
          // 100MB
          logger.info(
            `Processed ${totalRecords} records for year ${year} (${Object.keys(stateAggregatedData).length} states so far)`,
          );
        }
      }

      // Save combined data for each state
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

      // Save all state data in batches for better performance
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

      // Get all unique states
      const states = await this.repository.getAllUniqueStates();
      logger.info(`Found ${states.length} states to process`);

      if (states.length === 0) {
        logger.warn('No states found for signal calculation');
        return;
      }

      // Calculate signals for all states and collect slopes for normalization
      const stateSignals: Array<{
        state: string;
        physicalSlope: number;
        ecommerceSlope: number;
        physicalTrend: 'declining' | 'stable' | 'growing';
        ecommerceTrend: 'declining' | 'stable' | 'growing';
        dataPoints: number;
        yearsAnalyzed: number[];
      }> = [];

      // Process states in batches to avoid memory issues
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

            // Sort by year
            const sortedData = stateData.sort((a, b) => a.year - b.year);

            // Calculate physical retail signal (brick and mortar)
            const physicalDataPoints: { year: number; retailLq: number }[] = [];
            for (const data of sortedData) {
              const totalPhysicalLq = Object.values(
                data.brickAndMortarCodes,
              ).reduce((sum, lq) => sum + lq, 0);
              if (totalPhysicalLq > 0) {
                physicalDataPoints.push({
                  year: data.year,
                  retailLq: totalPhysicalLq,
                });
              }
            }

            if (physicalDataPoints.length < 2) {
              logger.warn(`Insufficient physical data points for ${state}`);
              return null;
            }

            const physicalSlope = calculateTrendSlope(physicalDataPoints);
            const physicalTrend = determineTrendCategory(physicalSlope);

            // Calculate e-commerce signal using weighted approach
            const ecommerceCodeSlopes: Array<{
              slope: number;
              dataPoints: number;
            }> = [];
            let totalDataPoints = 0;

            // Get all unique e-commerce codes for this state
            const allEcommerceCodes = new Set<string>();
            for (const data of sortedData) {
              Object.keys(data.ecommerceCodes).forEach((code) => {
                if (data.ecommerceCodes[code] > 0) {
                  allEcommerceCodes.add(code);
                }
              });
            }

            // Calculate individual slopes for each e-commerce code
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
              // Calculate weighted average slope
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
              dataPoints: physicalDataPoints.length,
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

        // Add a small delay between batches to prevent throttling
        if (i < batches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Normalize slopes using z-score across all states
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

      // Calculate normalized scores and save signals
      for (const signal of stateSignals) {
        try {
          // Calculate z-scores
          const physicalZScore =
            (signal.physicalSlope - physicalMean) / physicalStd;
          const ecommerceZScore =
            (signal.ecommerceSlope - ecommerceMean) / ecommerceStd;

          // Invert physical retail signal (decline = higher score)
          const physicalComponent = -physicalZScore;
          const ecommerceComponent = ecommerceZScore;

          // Convert to 0-100 scale
          const physicalScore = Math.max(
            0,
            Math.min(100, 50 + physicalComponent * 25),
          );
          const ecommerceScore = Math.max(
            0,
            Math.min(100, 50 + ecommerceComponent * 25),
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

      // Use all years for both signals (1991-2024)
      const physicalRetailData = sortedData;

      logger.info(
        `Processing ${state}: physical retail (${physicalRetailData.length} years), e-commerce (weighted approach)`,
      );

      // Find consistent brick and mortar codes across all years (physical retail)
      const consistentBrickAndMortarCodes = this.findConsistentIndustryCodes(
        physicalRetailData,
        'brickAndMortarCodes',
      );

      if (consistentBrickAndMortarCodes.length === 0) {
        logger.warn(`No consistent industry codes found for state ${state}`);
        return;
      }

      // Calculate brick and mortar aggregated data using consistent codes (all years)
      const brickAndMortarDataPoints: { year: number; retailLq: number }[] = [];
      for (const data of physicalRetailData) {
        let aggregatedLq = 0;
        for (const code of consistentBrickAndMortarCodes) {
          if (data.brickAndMortarCodes[code]) {
            aggregatedLq += data.brickAndMortarCodes[code];
          }
        }
        if (aggregatedLq > 0) {
          brickAndMortarDataPoints.push({
            year: data.year,
            retailLq: aggregatedLq,
          });
        }
      }

      // Calculate weighted e-commerce slopes for individual codes (using all years 1991-2021)
      const ecommerceCodeSlopes: {
        code: string;
        slope: number;
        dataPoints: number;
      }[] = [];

      // Get all unique e-commerce codes from all years
      const allEcommerceCodes = new Set<string>();
      for (const data of sortedData) {
        for (const code of Object.keys(data.ecommerceCodes)) {
          if (data.ecommerceCodes[code] > 0) {
            allEcommerceCodes.add(code);
          }
        }
      }

      // Calculate individual slopes for each e-commerce code
      for (const code of allEcommerceCodes) {
        const codeDataPoints: { year: number; retailLq: number }[] = [];

        // Collect all non-zero data points for this code
        for (const data of sortedData) {
          if (data.ecommerceCodes[code] && data.ecommerceCodes[code] > 0) {
            codeDataPoints.push({
              year: data.year,
              retailLq: data.ecommerceCodes[code],
            });
          }
        }

        // Calculate slope if we have at least 2 data points
        if (codeDataPoints.length >= 2) {
          const slope = calculateTrendSlope(codeDataPoints);
          ecommerceCodeSlopes.push({
            code,
            slope,
            dataPoints: codeDataPoints.length,
          });
        }
      }

      // Calculate trend slope for brick and mortar retail (inverted)...
      let brickAndMortarSlope = 0;
      let brickAndMortarTrend: 'declining' | 'stable' | 'growing' = 'stable';
      let physicalScore = 0;

      if (brickAndMortarDataPoints.length >= 2) {
        brickAndMortarSlope = calculateTrendSlope(brickAndMortarDataPoints);
        brickAndMortarTrend = determineTrendCategory(brickAndMortarSlope);
        physicalScore = calculateBlockbusterScore(
          brickAndMortarSlope,
          brickAndMortarTrend,
        );
      } else if (brickAndMortarDataPoints.length === 1) {
        // Single data point - assign middle score
        physicalScore = 50;
      }

      // Calculate weighted slope
      let ecommerceSlope = 0;
      let ecommerceTrend: 'declining' | 'stable' | 'growing' = 'stable';
      let ecommerceScore = 0;
      let totalDataPoints = 0;

      if (ecommerceCodeSlopes.length > 0) {
        // Weight by data points: (slope1 * years1 + slope2 * years2) / (years1 + years2)
        for (const codeSlope of ecommerceCodeSlopes) {
          ecommerceSlope += codeSlope.slope * codeSlope.dataPoints;
          totalDataPoints += codeSlope.dataPoints;
        }

        if (totalDataPoints > 0) {
          ecommerceSlope = ecommerceSlope / totalDataPoints;
          ecommerceTrend = determineTrendCategory(ecommerceSlope);
          ecommerceScore = this.calculateEcommerceScore(
            ecommerceSlope,
            ecommerceTrend,
          );
        }
      } else if (ecommerceCodeSlopes.length === 1) {
        // Single code with single data point - assign middle score
        ecommerceScore = 50;
      }

      // Only skip if we have no data at all
      if (
        brickAndMortarDataPoints.length === 0 &&
        ecommerceCodeSlopes.length === 0
      ) {
        logger.warn(`No data found for state ${state}`);
        return;
      }

      // Create signal record with both scores...
      const signalRecord: BlsSignalRecord = {
        state,
        timestamp: Math.floor(Date.now() / 1000),
        calculatedAt: new Date().toISOString(),
        physicalSlope: brickAndMortarSlope,
        physicalTrend: brickAndMortarTrend,
        ecommerceSlope: ecommerceSlope,
        ecommerceTrend: ecommerceTrend,
        physicalScore,
        ecommerceScore,
        dataPoints: sortedData.length,
        yearsAnalyzed: sortedData.map((d) => d.year),
      };

      await this.repository.saveSignal(signalRecord);

      logger.info(
        `Calculated signal for ${state}: physicalScore=${physicalScore} (${brickAndMortarDataPoints.length} points, ${physicalRetailData.length} years), ecommerceScore=${ecommerceScore} (${ecommerceCodeSlopes.length} codes, ${totalDataPoints} total points)`,
      );
    } catch (error) {
      logger.error(`Error calculating signal for state ${state}:`, error);
      throw error;
    }
  }

  private findConsistentIndustryCodes(
    stateData: BlsStateData[],
    codeType: 'brickAndMortarCodes' | 'ecommerceCodes',
  ): string[] {
    // Get all unique industry codes across all years
    const allCodes = new Set<string>();
    for (const data of stateData) {
      const codes = Object.keys(data[codeType]);
      codes.forEach((code) => allCodes.add(code));
    }

    // Find codes that exist in all years
    const consistentCodes: string[] = [];
    for (const code of allCodes) {
      const yearsWithCode = new Set<number>();
      for (const data of stateData) {
        if (data[codeType][code]) {
          yearsWithCode.add(data.year);
        }
      }

      // If code exists in all years, it's consistent
      if (yearsWithCode.size === stateData.length) {
        consistentCodes.push(code);
      }
    }

    return consistentCodes;
  }

  private calculateEcommerceScore(
    slope: number,
    trend: 'declining' | 'stable' | 'growing',
  ): number {
    // For e-commerce, we want increasing employment = higher score (non-inverted)
    // - Growing e-commerce LQ = higher score (more disruption).
    // - Declining e-commerce LQ = lower score (less disruption).
    // - Stable e-commerce LQ = middle score.

    let baseScore: number;

    switch (trend) {
      case 'growing':
        // Convert positive slope to positive score (0-100).
        // More positive slope = higher score.
        baseScore = Math.min(100, Math.max(0, slope * 0.1));
        break;
      case 'declining':
        // Convert negative slope to lower score (0-100).
        // More negative slope = lower score.
        baseScore = Math.max(0, 100 - Math.abs(slope) * 0.1);
        break;
      case 'stable':
        // Middle score for stable trends...
        baseScore = 50;
        break;
      default:
        baseScore = 50;
    }

    // Normalize to 0-100 range...
    return Math.max(0, Math.min(100, baseScore));
  }

  async calculateStateMetrics(state: string): Promise<BlsMetrics | null> {
    try {
      const latestSignal = await this.repository.getLatestSignal(state);
      if (!latestSignal) {
        return null;
      }

      return {
        physicalSlope: latestSignal.physicalSlope,
        physicalTrend: latestSignal.physicalTrend,
        ecommerceSlope: latestSignal.ecommerceSlope,
        ecommerceTrend: latestSignal.ecommerceTrend,
        physicalScore: latestSignal.physicalScore,
        ecommerceScore: latestSignal.ecommerceScore,
        dataPoints: latestSignal.dataPoints,
        yearsAnalyzed: latestSignal.yearsAnalyzed,
      };
    } catch (error) {
      logger.error(`Error calculating metrics for state ${state}:`, error);
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

      logger.info(
        `Retrieved physical scores for ${Object.keys(scores).length} states`,
      );
      return scores;
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

  async getAllScores(): Promise<Record<string, number>> {
    try {
      const signals = await this.repository.getAllSignals();
      const scores: Record<string, number> = {};

      for (const signal of signals) {
        // Combine both scores equally: (physicalScore + ecommerceScore) / 2
        scores[signal.state] =
          (signal.physicalScore + signal.ecommerceScore) / 2;
      }

      logger.info(
        `Retrieved combined scores for ${Object.keys(scores).length} states`,
      );
      return scores;
    } catch (error) {
      logger.error('Error getting all scores:', error);
      throw error;
    }
  }

  async getAllIndividualScores(): Promise<
    Record<string, { physicalScore: number; ecommerceScore: number }>
  > {
    try {
      const signals = await this.repository.getAllSignals();
      const scores: Record<
        string,
        { physicalScore: number; ecommerceScore: number }
      > = {};

      for (const signal of signals) {
        scores[signal.state] = {
          physicalScore: signal.physicalScore,
          ecommerceScore: signal.ecommerceScore,
        };
      }

      logger.info(
        `Retrieved individual scores for ${Object.keys(scores).length} states`,
      );
      return scores;
    } catch (error) {
      logger.error('Error getting individual scores:', error);
      throw error;
    }
  }

  // TEMPORARY TESTING METHOD - REMOVE AFTER TESTING
  async testSingleStateProcessing(): Promise<void> {
    logger.info('TESTING: Starting single state processing test...');

    try {
      // Test with pre-1998 format (1995)
      logger.info('TESTING: Processing pre-1998 format (1995)...');
      const pre1998Year = '1995';
      const pre1998Data: BlsStateData[] = [];

      for await (const chunk of this.s3Loader.processCsvInChunks(
        pre1998Year,
        10000,
      )) {
        const stateData = testSingleStateProcessing(
          chunk,
          parseInt(pre1998Year, 10),
          'CA',
        );
        pre1998Data.push(...stateData);
      }

      logger.info(
        `TESTING: Pre-1998 results: ${pre1998Data.length} records for CA in 1995`,
      );

      // Test with post-1998 format (2005)
      logger.info('TESTING: Processing post-1998 format (2005)...');
      const post1998Year = '2005';
      const post1998Data: BlsStateData[] = [];

      for await (const chunk of this.s3Loader.processCsvInChunks(
        post1998Year,
        10000,
      )) {
        const stateData = testSingleStateProcessing(
          chunk,
          parseInt(post1998Year, 10),
          'CA',
        );
        post1998Data.push(...stateData);
      }

      logger.info(
        `TESTING: Post-1998 results: ${post1998Data.length} records for CA in 2005`,
      );

      // Summary
      logger.info('TESTING: Summary of single state processing test:', {
        pre1998Records: pre1998Data.length,
        post1998Records: post1998Data.length,
        pre1998Sample: pre1998Data.slice(0, 3),
        post1998Sample: post1998Data.slice(0, 3),
      });
    } catch (error) {
      logger.error('TESTING: Error in single state processing test:', error);
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
