import { LoggerFactory } from '../../util/logger';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { parse } from 'csv-parse';
import { TECHNOLOGY_CODES, SPEED_THRESHOLDS } from '../../constants/broadband';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband';
import type {
  S3BroadbandCsvRecord,
  BroadbandMetrics,
  TechnologyCounts,
} from '../../types/broadband';
import { BroadbandService } from '../../services/broadband/broadband-service';

const logger = LoggerFactory.getBroadbandLogger();
const DEFAULT_TABLE = 'blockbuster-index-broadband-signals-dev';

export function mapTechCodeToTechnology(techCode: string): string {
  const code = parseInt(techCode);

  if (TECHNOLOGY_CODES.FIBER.includes(code)) return 'Fiber';
  if (TECHNOLOGY_CODES.CABLE.includes(code)) return 'Cable';
  if (TECHNOLOGY_CODES.DSL.includes(code)) return 'DSL';
  if (TECHNOLOGY_CODES.WIRELESS.includes(code)) return 'Wireless';
  if (TECHNOLOGY_CODES.OTHER.includes(code)) return 'Other';

  return 'Unknown';
}

export class S3BroadbandLoader {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-west-2',
    });
  }

  async getLatestDataVersion(): Promise<string | null> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Delimiter: '/',
      });

      const response = await this.s3Client.send(command);

      if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
        logger.warn('No data versions found in S3 bucket');
        return null;
      }

      // Extract version names from prefixes (e.g., "Dec2021-v1/")...

      const versions = response.CommonPrefixes.map((prefix) =>
        prefix.Prefix?.replace('/', ''),
      ).filter(Boolean) as string[];

      if (versions.length === 0) {
        return null;
      }

      // Sort versions and return the latest (assuming format like "Dec2021-v1")...

      const sortedVersions = versions.sort();
      const latestVersion = sortedVersions[sortedVersions.length - 1];

      logger.info(`Found latest data version: ${latestVersion}`);
      return latestVersion;
    } catch (error) {
      logger.error('Error getting latest data version from S3:', error);
      return null;
    }
  }

  async listStateFiles(dataVersion: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${dataVersion}/`,
      });

      const response = await this.s3Client.send(command);

      if (!response.Contents) {
        logger.warn(`No files found in S3 for version ${dataVersion}`);
        return [];
      }

      const csvFiles = response.Contents.map((obj) => obj.Key)
        .filter((key) => key?.endsWith('.csv'))
        .filter(Boolean) as string[];

      logger.info(
        `Found ${csvFiles.length} CSV files in S3 for version ${dataVersion}`,
      );
      return csvFiles;
    } catch (error) {
      logger.error('Error listing state files from S3:', error);
      return [];
    }
  }

  private initializeMetrics() {
    return {
      blocksWithBroadband: new Set<string>(),
      blocksWithHighSpeed: new Set<string>(),
      blocksWithGigabit: new Set<string>(),
    };
  }

  private async checkIfStateExists(
    state: string,
    dataVersion: string,
  ): Promise<boolean> {
    try {
      const tempRepo = new DynamoDBBroadbandSignalRepository(
        process.env.BROADBAND_DYNAMODB_TABLE_NAME || DEFAULT_TABLE,
      );
      const existingRecord = await tempRepo.getByStateAndVersion(
        state,
        dataVersion,
      );
      return !!existingRecord;
    } catch (error) {
      logger.error(`Error checking if state ${state} exists:`, error);
      return false;
    }
  }

  async downloadAndParseCSV(s3Key: string): Promise<{
    state: string;
    metrics: BroadbandMetrics;
    dataVersion: string;
    lastUpdated: Date;
  }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`No body in S3 response for key: ${s3Key}`);
      }

      // Extract state from filename (e.g., "Dec2021-v1/CA-Fixed-Dec2021-v1.csv" -> "CA")...

      const stateMatch = s3Key.match(/\/([A-Z]{2})-Fixed-/);
      if (!stateMatch) {
        throw new Error(`Could not extract state from S3 key: ${s3Key}`);
      }
      const state = stateMatch[1];
      logger.info(`Processing ${state} data from S3 key: ${s3Key}`);

      // Stream parse CSV content and aggregate metrics on the fly...

      const metrics = this.initializeMetrics();
      const uniqueBlocks = new Set<string>();
      const speeds: number[] = [];
      const technologyCounts: TechnologyCounts = {
        fiber: 0,
        cable: 0,
        dsl: 0,
        wireless: 0,
        other: 0,
      };

      return new Promise(async (resolve, reject) => {
        try {
          const stream = response.Body as NodeJS.ReadableStream;
          const parser = parse({
            columns: true,
            skip_empty_lines: true,
          });

          parser.on('readable', () => {
            let record: S3BroadbandCsvRecord;
            while ((record = parser.read() as S3BroadbandCsvRecord)) {
              // Streaming aggregation logic...

              const blockCode = record.BlockCode || '';
              uniqueBlocks.add(blockCode);
              const speed = parseFloat(record.MaxAdDown || '0');
              speeds.push(speed);
              const tech = mapTechCodeToTechnology(record.TechCode || '');
              if (
                technologyCounts[
                  tech.toLowerCase() as keyof TechnologyCounts
                ] !== undefined
              ) {
                technologyCounts[
                  tech.toLowerCase() as keyof TechnologyCounts
                ]! += 1;
              } else {
                technologyCounts.other += 1;
              }

              // Count blocks with broadband, high speed, gigabit...

              if (speed >= SPEED_THRESHOLDS.BROADBAND_MIN)
                metrics.blocksWithBroadband.add(blockCode);
              if (speed >= SPEED_THRESHOLDS.BROADBAND_MIN)
                metrics.blocksWithHighSpeed.add(blockCode);
              if (speed >= SPEED_THRESHOLDS.GIGABIT)
                metrics.blocksWithGigabit.add(blockCode);
            }
          });

          parser.on('end', () => {
            // Final aggregation...

            const totalCensusBlocks = uniqueBlocks.size;
            const blocksWithBroadband = metrics.blocksWithBroadband.size;
            const blocksWithHighSpeed = metrics.blocksWithHighSpeed.size;
            const blocksWithGigabit = metrics.blocksWithGigabit.size;
            const broadbandAvailabilityPercent =
              totalCensusBlocks > 0
                ? (blocksWithBroadband / totalCensusBlocks) * 100
                : 0;
            const highSpeedAvailabilityPercent =
              totalCensusBlocks > 0
                ? (blocksWithHighSpeed / totalCensusBlocks) * 100
                : 0;
            const gigabitAvailabilityPercent =
              totalCensusBlocks > 0
                ? (blocksWithGigabit / totalCensusBlocks) * 100
                : 0;
            const averageDownloadSpeed =
              speeds.length > 0
                ? speeds.reduce((a, b) => a + b, 0) / speeds.length
                : 0;
            const medianDownloadSpeed =
              speeds.length > 0
                ? speeds.length % 2 === 0
                  ? (() => {
                      const sorted = speeds.slice().sort((a, b) => a - b);
                      return (
                        (sorted[sorted.length / 2 - 1] +
                          sorted[sorted.length / 2]) /
                        2
                      );
                    })()
                  : (() => {
                      const sorted = speeds.slice().sort((a, b) => a - b);
                      return sorted[Math.floor(sorted.length / 2)];
                    })()
                : 0;

            // Calculate broadbandScore (reuse your existing logic if possible)...

            const broadbandScore =
              BroadbandService.calculateBroadbandScoreStatic({
                broadbandAvailabilityPercent,
                highSpeedAvailabilityPercent,
                gigabitAvailabilityPercent,
                technologyCounts,
              });
            resolve({
              state,
              metrics: {
                totalCensusBlocks,
                blocksWithBroadband,
                broadbandAvailabilityPercent,
                blocksWithHighSpeed,
                highSpeedAvailabilityPercent,
                blocksWithGigabit,
                gigabitAvailabilityPercent,
                technologyCounts,
                averageDownloadSpeed,
                medianDownloadSpeed,
                broadbandScore,
              },
              dataVersion: s3Key.split('/')[0],
              lastUpdated: new Date(),
            });
          });

          parser.on('error', (error) => {
            reject(error);
          });

          stream.pipe(parser);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      logger.error(
        `Error downloading and parsing CSV from S3 key ${s3Key}:`,
        error,
      );
      throw error;
    }
  }

  async loadBroadbandData(): Promise<
    Array<{ state: string; dataVersion: string; lastUpdated: Date }>
  > {
    const dataVersion = await this.getLatestDataVersion();

    if (!dataVersion) {
      logger.warn('No data version found in S3');
      return [];
    }

    const stateFiles = await this.listStateFiles(dataVersion);

    if (stateFiles.length === 0) {
      logger.warn(`No state files found for version ${dataVersion}`);
      return [];
    }

    // Process all states...

    const statesToProcess = stateFiles;
    logger.info(`Processing all ${statesToProcess.length} states`);

    const processedData: Array<{
      state: string;
      dataVersion: string;
      lastUpdated: Date;
    }> = [];

    for (const s3Key of statesToProcess) {
      // Extract state from filename (e.g., "Dec2021-v1/CA-Fixed-Dec2021-v1.csv" -> "CA")...

      const stateMatch = s3Key.match(/\/([A-Z]{2})-Fixed-/);
      if (!stateMatch) {
        logger.warn(`Could not extract state from S3 key: ${s3Key}`);
        continue;
      }
      const state = stateMatch[1];

      // Check if already processed...

      const alreadyProcessed = await this.checkIfStateExists(
        state,
        dataVersion,
      );
      if (alreadyProcessed) {
        logger.info(
          `Skipping ${state} - data version ${dataVersion} already processed`,
        );
        continue;
      }
      try {
        logger.info(`Downloading and processing ${s3Key}`);
        const result = await this.downloadAndParseCSV(s3Key);
        processedData.push({
          state: result.state,
          dataVersion: result.dataVersion,
          lastUpdated: result.lastUpdated,
        });
      } catch (error) {
        logger.error(`Error processing S3 file ${s3Key}:`, error);
      }
    }

    logger.info(
      `Processed ${processedData.length} state files out of ${statesToProcess.length} total files`,
    );

    return processedData;
  }

  async processStatesOneByOne(
    callback: (stateData: {
      state: string;
      metrics: BroadbandMetrics;
      dataVersion: string;
      lastUpdated: Date;
    }) => Promise<void>,
  ): Promise<void> {
    const dataVersion = await this.getLatestDataVersion();

    if (!dataVersion) {
      logger.warn('No data version found in S3');
      return;
    }

    const stateFiles = await this.listStateFiles(dataVersion);

    if (stateFiles.length === 0) {
      logger.warn(`No state files found for version ${dataVersion}`);
      return;
    }

    for (const s3Key of stateFiles) {
      // Extract state from filename (e.g., "Dec2021-v1/CA-Fixed-Dec2021-v1.csv" -> "CA")...

      const stateMatch = s3Key.match(/\/([A-Z]{2})-Fixed-/);
      if (!stateMatch) {
        logger.warn(`Could not extract state from S3 key: ${s3Key}`);
        continue;
      }
      const state = stateMatch[1];

      // Check if already processed...

      const alreadyProcessed = await this.checkIfStateExists(
        state,
        dataVersion,
      );
      if (alreadyProcessed) {
        logger.info(
          `Skipping ${state} - data version ${dataVersion} already processed`,
        );
        continue;
      }
      try {
        const result = await this.downloadAndParseCSV(s3Key);
        await callback({
          state: result.state,
          metrics: result.metrics,
          dataVersion: result.dataVersion,
          lastUpdated: result.lastUpdated,
        });
      } catch (error) {
        logger.error(`Error processing S3 file ${s3Key}:`, error);
      }
    }
  }
}
