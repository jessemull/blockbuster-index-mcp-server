import { logger } from '../../util/logger';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { parse } from 'csv-parse';
import { TECHNOLOGY_CODES } from '../../constants/broadband';
import { DynamoDBBroadbandSignalRepository } from '../../repositories/broadband-signal-repository';
import type {
  S3BroadbandCsvRecord,
  BroadbandRecord,
  S3BroadbandData,
} from '../../types/broadband';

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

  async downloadAndParseCSV(s3Key: string): Promise<BroadbandRecord[]> {
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

      // Stream parse CSV content to avoid memory issues with large files...

      const broadbandRecords: BroadbandRecord[] = [];

      return new Promise(async (resolve, reject) => {
        try {
          // Convert the response body to a readable stream...

          const stream = response.Body as NodeJS.ReadableStream;

          const parser = parse({
            columns: true,
            skip_empty_lines: true,
          });

          parser.on('readable', () => {
            let record: S3BroadbandCsvRecord;
            while ((record = parser.read() as S3BroadbandCsvRecord)) {
              broadbandRecords.push({
                state: record.StateAbbr || state,
                censusBlock: record.BlockCode || '',
                provider: record.ProviderName || '',
                technology: mapTechCodeToTechnology(record.TechCode || ''),
                speed: parseFloat(record.MaxAdDown || '0'),
              });
            }
          });

          parser.on('end', () => {
            logger.info(
              `Processed ${broadbandRecords.length} records for ${state}`,
            );
            resolve(broadbandRecords);
          });

          parser.on('error', (error) => {
            reject(error);
          });

          // Pipe the S3 response body to the parser...

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

  async loadBroadbandData(): Promise<S3BroadbandData[]> {
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

    const processedData: S3BroadbandData[] = [];

    for (const s3Key of statesToProcess) {
      try {
        logger.info(`Downloading and processing ${s3Key}`);
        const records = await this.downloadAndParseCSV(s3Key);

        // Extract state from the first record or filename...

        const state =
          records.length > 0
            ? records[0].state
            : s3Key.match(/\/([A-Z]{2})-Fixed-/)?.[1] || 'Unknown';

        processedData.push({
          state,
          records,
          dataVersion,
          lastUpdated: new Date(),
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
    callback: (stateData: S3BroadbandData) => Promise<void>,
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

    // Process all states...

    const statesToProcess = stateFiles;
    logger.info(`Processing all ${statesToProcess.length} states`);

    for (const s3Key of statesToProcess) {
      try {
        // Extract state from filename before downloading...

        const stateMatch = s3Key.match(/\/([A-Z]{2})-Fixed-/);
        if (!stateMatch) {
          logger.error(`Could not extract state from S3 key: ${s3Key}`);
          continue;
        }
        const state = stateMatch[1];

        // Check if this state+version already exists in DynamoDB...

        const existingRecord = await this.checkIfStateExists(
          state,
          dataVersion,
        );

        if (existingRecord) {
          logger.info(
            `State ${state} version ${dataVersion} already exists in DynamoDB, skipping download`,
          );
          continue;
        }

        logger.info(
          `State ${state} version ${dataVersion} not found in DynamoDB, downloading CSV`,
        );
        const records = await this.downloadAndParseCSV(s3Key);

        const stateData: S3BroadbandData = {
          state,
          records,
          dataVersion,
          lastUpdated: new Date(),
        };

        // Immediately process this state...

        await callback(stateData);
      } catch (error) {
        logger.error(`Error processing S3 file ${s3Key}:`, error);
      }
    }
  }

  private async checkIfStateExists(
    state: string,
    dataVersion: string,
  ): Promise<boolean> {
    try {
      // Create a temporary repository to check if state exists...

      const tempRepo = new DynamoDBBroadbandSignalRepository(
        process.env.BROADBAND_DYNAMODB_TABLE_NAME ||
          'blockbuster-index-broadband-signals-dev',
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
}
