import { logger } from '../../util';
import { BroadbandCsvRecord } from '../../types/broadband';
import { SPEED_THRESHOLDS, TECHNOLOGY_CODES } from '../../constants/broadband';
import { PRECISION } from '../../constants';
import { S3BroadbandLoader } from '../../signals/broadband/s3-broadband-loader';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband';
import type {
  BroadbandMetrics,
  TechnologyCounts,
  BroadbandSignalRecord,
  StateVersionMetadata,
} from '../../types/broadband';

export class BroadbandService {
  private repository: DynamoDBBroadbandSignalRepository | undefined;
  private s3Loader: S3BroadbandLoader;

  constructor(repository?: DynamoDBBroadbandSignalRepository) {
    this.repository = repository;

    // DEBUG: Log environment variables for troubleshooting
    logger.info('ENV_DEBUG_BROADBAND: Starting environment variable check');
    logger.info(
      `ENV_DEBUG_BROADBAND: BROADBAND_S3_BUCKET = ${process.env.BROADBAND_S3_BUCKET || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_BROADBAND: NODE_ENV = ${process.env.NODE_ENV || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_BROADBAND: AWS_REGION = ${process.env.AWS_REGION || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_BROADBAND: BROADBAND_DYNAMODB_TABLE_NAME = ${process.env.BROADBAND_DYNAMODB_TABLE_NAME || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_BROADBAND: SIGNAL_SCORES_DYNAMODB_TABLE_NAME = ${process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME || 'UNDEFINED'}`,
    );
    logger.info(
      `ENV_DEBUG_BROADBAND: npm_package_version = ${process.env.npm_package_version || 'UNDEFINED'}`,
    );
    logger.info('ENV_DEBUG_BROADBAND: Environment variable check completed');

    this.s3Loader = new S3BroadbandLoader(
      process.env.BROADBAND_S3_BUCKET || 'blockbuster-index-broadband-dev',
    );
  }

  async processBroadbandData(): Promise<void> {
    logger.info('Starting broadband data processing from S3...');

    try {
      // Process states one at a time as they're downloaded...

      await this.s3Loader.processStatesOneByOne(
        this.processStateCallback.bind(this),
      );

      logger.info('Broadband data processing completed');
    } catch (error) {
      logger.error('Error in broadband data processing:', error);
      throw error;
    }
  }

  private async processStateCallback(stateData: {
    state: string;
    metrics: BroadbandMetrics;
    dataVersion: string;
    lastUpdated: Date;
  }): Promise<void> {
    logger.info(`About to process state: ${stateData.state}`);
    await this.processStateData(stateData);
    logger.info(`Finished processing state: ${stateData.state}`);
  }

  private async processStateData(stateData: {
    state: string;
    metrics: BroadbandMetrics;
    dataVersion: string;
    lastUpdated: Date;
  }): Promise<void> {
    const { state, metrics, dataVersion } = stateData;

    logger.info(
      `Starting to process ${state} with pre-calculated metrics (S3 version: ${dataVersion})`,
    );

    try {
      // Check if we need to process this state's data...

      const shouldProcess = await this.shouldProcessStateData(
        state,
        dataVersion,
      );

      if (!shouldProcess) {
        logger.info(
          `Skipping ${state} - data version ${dataVersion} already processed`,
        );
        return;
      }

      logger.info(
        `Will process ${state} with ${metrics.totalCensusBlocks} total blocks (version: ${dataVersion})`,
      );

      // Create a single aggregated record for this state using pre-calculated metrics...

      const broadbandRecord: BroadbandSignalRecord = {
        state,
        timestamp: Date.now(),
        dataVersion,
        totalCensusBlocks: metrics.totalCensusBlocks,
        blocksWithBroadband: metrics.blocksWithBroadband,
        broadbandAvailabilityPercent: metrics.broadbandAvailabilityPercent,
        blocksWithHighSpeed: metrics.blocksWithHighSpeed,
        highSpeedAvailabilityPercent: metrics.highSpeedAvailabilityPercent,
        blocksWithGigabit: metrics.blocksWithGigabit,
        gigabitAvailabilityPercent: metrics.gigabitAvailabilityPercent,
        technologyCounts: metrics.technologyCounts,
        averageDownloadSpeed: metrics.averageDownloadSpeed,
        medianDownloadSpeed: metrics.medianDownloadSpeed,
        broadbandScore: metrics.broadbandScore,
      };

      // Save the aggregated record...

      if (this.repository) {
        logger.info(`About to save broadband record for ${state} to DynamoDB`);
        await this.repository.save(broadbandRecord);
        logger.info(
          `Successfully saved broadband record for ${state} to DynamoDB`,
        );

        // Save metadata record for version tracking...

        const metadataRecord: StateVersionMetadata = {
          state,
          dataVersion,
          lastProcessed: Date.now(),
        };
        await this.repository.saveStateVersionMetadata(metadataRecord);
        logger.info(
          `Successfully saved metadata record for ${state} to DynamoDB`,
        );
      } else {
        logger.info(
          `No repository available, skipping DynamoDB save for ${state}`,
        );
      }

      logger.info(
        `Successfully processed aggregated metrics for ${state} (version: ${dataVersion})`,
        {
          totalBlocks: metrics.totalCensusBlocks,
          availabilityPercent: metrics.broadbandAvailabilityPercent,
          score: metrics.broadbandScore,
        },
      );
    } catch (error) {
      logger.error(`Error processing state data for ${state}:`, error);
    }
  }

  private async shouldProcessStateData(
    state: string,
    s3DataVersion: string,
  ): Promise<boolean> {
    if (!this.repository) {
      logger.info(`No repository available for ${state}, will process`);
      return true;
    }

    try {
      // Check if this specific state+version combination already exists...

      const existingRecord = await this.repository.getByStateAndVersion(
        state,
        s3DataVersion,
      );

      logger.info(
        `Version check for ${state}: S3 version=${s3DataVersion}, existing record=${existingRecord ? 'YES' : 'NO'}`,
      );

      if (existingRecord) {
        logger.info(
          `State ${state} version ${s3DataVersion} already exists in DynamoDB, skipping`,
        );
        return false;
      }

      logger.info(
        `State ${state} version ${s3DataVersion} not found in DynamoDB, will process`,
      );
      return true;
    } catch (error) {
      logger.error(`Error checking version for ${state}:`, error);

      // If we can't determine the version, process the data to be safe...

      return true;
    }
  }

  private isVersionNewer(newVersion: string, existingVersion: string): boolean {
    return newVersion > existingVersion;
  }

  async getAllScores(): Promise<Record<string, number>> {
    if (!this.repository) {
      logger.info('No repository available, returning empty scores');
      return {};
    }

    try {
      return await this.repository.getAllScores();
    } catch (error) {
      logger.error('Error getting broadband scores:', error);
      return {};
    }
  }

  // Calculate broadband metrics for a single state...

  private calculateBroadbandMetrics(
    records: BroadbandCsvRecord[],
  ): BroadbandMetrics {
    // Get unique census blocks
    const uniqueBlocks = new Set(records.map((r) => r.BlockCode));
    const totalCensusBlocks = uniqueBlocks.size;

    // Calculate coverage metrics...

    const blocksWithBroadband = this.countBlocksWithBroadband(records);
    const blocksWithHighSpeed = this.countBlocksWithSpeed(
      records,
      SPEED_THRESHOLDS.BROADBAND_MIN,
    );
    const blocksWithGigabit = this.countBlocksWithSpeed(
      records,
      SPEED_THRESHOLDS.GIGABIT,
    );

    // Calculate percentages...

    const broadbandAvailabilityPercent =
      totalCensusBlocks > 0
        ? (blocksWithBroadband / totalCensusBlocks) * 100
        : 0;
    const highSpeedAvailabilityPercent =
      totalCensusBlocks > 0
        ? (blocksWithHighSpeed / totalCensusBlocks) * 100
        : 0;
    const gigabitAvailabilityPercent =
      totalCensusBlocks > 0 ? (blocksWithGigabit / totalCensusBlocks) * 100 : 0;

    // Calculate technology counts...

    const technologyCounts = this.calculateTechnologyCounts(records);

    // Calculate speed statistics...

    const speeds = this.extractSpeeds(records);
    const averageDownloadSpeed = this.calculateAverage(speeds);
    const medianDownloadSpeed = this.calculateMedian(speeds);

    // Calculate overall broadband score...

    const broadbandScore = this.calculateBroadbandScore({
      broadbandAvailabilityPercent,
      highSpeedAvailabilityPercent,
      gigabitAvailabilityPercent,
      technologyCounts,
    });

    return {
      totalCensusBlocks,
      blocksWithBroadband,
      broadbandAvailabilityPercent:
        Math.round(broadbandAvailabilityPercent * 100) / 100,
      blocksWithHighSpeed,
      highSpeedAvailabilityPercent:
        Math.round(highSpeedAvailabilityPercent * 100) / 100,
      blocksWithGigabit,
      gigabitAvailabilityPercent:
        Math.round(gigabitAvailabilityPercent * 100) / 100,
      technologyCounts,
      averageDownloadSpeed: Math.round(averageDownloadSpeed * 100) / 100,
      medianDownloadSpeed: Math.round(medianDownloadSpeed * 100) / 100,
      broadbandScore:
        Math.round(broadbandScore * PRECISION.SCORE_ROUNDING) /
        PRECISION.SCORE_ROUNDING,
    };
  }

  // Count census blocks with any broadband service...

  private countBlocksWithBroadband(records: BroadbandCsvRecord[]): number {
    const blocksWithService = new Set<string>();

    for (const record of records) {
      const speed = parseFloat(record.MaxAdDown);
      if (speed > 0) {
        blocksWithService.add(record.BlockCode);
      }
    }

    return blocksWithService.size;
  }

  // Count census blocks with service meeting speed threshold...

  private countBlocksWithSpeed(
    records: BroadbandCsvRecord[],
    speedThreshold: number,
  ): number {
    const blocksWithSpeed = new Set<string>();

    for (const record of records) {
      const speed = parseFloat(record.MaxAdDown);
      if (speed >= speedThreshold) {
        blocksWithSpeed.add(record.BlockCode);
      }
    }

    return blocksWithSpeed.size;
  }

  // Calculate technology distribution...

  private calculateTechnologyCounts(
    records: BroadbandCsvRecord[],
  ): TechnologyCounts {
    const counts: TechnologyCounts = {
      fiber: 0,
      cable: 0,
      dsl: 0,
      wireless: 0,
      other: 0,
    };

    for (const record of records) {
      const techCode = parseInt(record.TechCode);

      if (TECHNOLOGY_CODES.FIBER.includes(techCode)) {
        counts.fiber++;
      } else if (TECHNOLOGY_CODES.CABLE.includes(techCode)) {
        counts.cable++;
      } else if (TECHNOLOGY_CODES.DSL.includes(techCode)) {
        counts.dsl++;
      } else if (TECHNOLOGY_CODES.WIRELESS.includes(techCode)) {
        counts.wireless++;
      } else {
        counts.other++;
      }
    }

    return counts;
  }

  // Extract download speeds from records...

  private extractSpeeds(records: BroadbandCsvRecord[]): number[] {
    return records
      .map((r) => parseFloat(r.MaxAdDown))
      .filter((speed) => speed > 0);
  }

  // Calculate average of number array...

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  // Calculate median of number array...

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  // Calculate overall broadband score (0-1 range)...

  private calculateBroadbandScore(metrics: {
    broadbandAvailabilityPercent: number;
    highSpeedAvailabilityPercent: number;
    gigabitAvailabilityPercent: number;
    technologyCounts: TechnologyCounts;
  }): number {
    // Technology diversity score (0-1)...

    const totalTech = Object.values(metrics.technologyCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const diversityScore =
      totalTech > 0
        ? Object.values(metrics.technologyCounts).filter((count) => count > 0)
            .length / 5
        : 0;

    // Weighted score calculation...

    const score =
      (metrics.broadbandAvailabilityPercent / 100) * 0.3 + // Basic availability.
      (metrics.highSpeedAvailabilityPercent / 100) * 0.4 + // Quality (25+ Mbps).
      (metrics.gigabitAvailabilityPercent / 100) * 0.2 + // Future-ready infrastructure.
      diversityScore * 0.1; // Infrastructure resilience.

    return Math.min(1, Math.max(0, score)); // Clamp to 0-1 range.
  }

  public static calculateBroadbandScoreStatic(metrics: {
    broadbandAvailabilityPercent: number;
    highSpeedAvailabilityPercent: number;
    gigabitAvailabilityPercent: number;
    technologyCounts: TechnologyCounts;
  }): number {
    const instance = new BroadbandService();
    return instance.calculateBroadbandScore(metrics);
  }
}
