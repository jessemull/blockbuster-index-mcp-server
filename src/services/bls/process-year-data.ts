import type { BlsProcessedFile, BlsStateData } from '../../types/bls';
import { DynamoDBBlsRepository } from '../../repositories/bls/bls-repository';
import { logger } from '../../util';
import { extractCombinedRetailDataFromCsv } from './extract-combined-retail-data';
import { S3BlsLoader } from './s3-bls-loader';
import { validateStateData } from './validate-state-data';

/**
 * Processes a single year of BLS CSV data from S3 into DynamoDB state records.
 */
export async function processYearData(
  year: string,
  repository: DynamoDBBlsRepository,
  s3Loader: S3BlsLoader,
): Promise<void> {
  try {
    // Check if this year has already been processed...

    const isProcessed = await repository.isFileProcessed(year);
    if (isProcessed) {
      logger.info(`Year ${year} already processed, skipping`);
      return;
    }

    logger.info(`Processing BLS data for year ${year}`);

    // Process the CSV file in chunks to manage memory...

    const fileSize = await s3Loader.getFileSize(year);
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

    for await (const chunk of s3Loader.processCsvInChunks(year, 10000)) {
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

    for (const [state, aggregatedData] of Object.entries(stateAggregatedData)) {
      const combinedRecord: BlsStateData = {
        brickAndMortarCodes: aggregatedData.brickAndMortarCodes,
        ecommerceCodes: aggregatedData.ecommerceCodes,
        state,
        timestamp: Math.floor(Date.now() / 1000),
        year: parseInt(year, 10),
      };

      if (validateStateData(combinedRecord)) {
        stateDataToSave.push(combinedRecord);
        validRecords++;
        processedStates.add(state);
      }
    }

    // Save all state data in batches for better performance...

    if (stateDataToSave.length > 0) {
      await repository.saveStateDataBatch(stateDataToSave);
      logger.info(`Saved ${stateDataToSave.length} state records in batches`);
    }

    // Mark the file as processed...

    const processedFile: BlsProcessedFile = {
      fileSize,
      processedAt: Math.floor(Date.now() / 1000),
      recordCount: validRecords,
      year,
    };

    await repository.saveProcessedFile(processedFile);

    logger.info(
      `Successfully processed year ${year}: ${validRecords} valid state records`,
    );
  } catch (error) {
    logger.error(`Failed to process year ${year}:`, error);
    throw error;
  }
}
