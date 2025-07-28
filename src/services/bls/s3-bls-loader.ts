import type { BlsCsvRecord } from '../../types/bls';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { logger } from '../../util';

export class S3BlsLoader {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(bucketName: string) {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.bucketName = bucketName;
  }

  async listAvailableYears(): Promise<string[]> {
    try {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: '',
        }),
      );

      if (!response.Contents) {
        return [];
      }

      const years: string[] = [];

      for (const object of response.Contents) {
        if (object.Key && object.Key.endsWith('.csv')) {
          const year = object.Key.replace('.annual.singlefile.csv', '');
          if (year.match(/^\d{4}$/)) {
            years.push(year);
          }
        }
      }

      return years.sort();
    } catch (error) {
      logger.error('Failed to list available years from S3', {
        error: error instanceof Error ? error.message : String(error),
        bucket: this.bucketName,
      });
      throw error;
    }
  }

  async downloadAndParseCsv(year: string): Promise<BlsCsvRecord[]> {
    try {
      logger.info(`Downloading BLS CSV for year ${year} from S3`);

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: `${year}.annual.singlefile.csv`,
        }),
      );

      if (!response.Body) {
        throw new Error(`No body in S3 response for year ${year}`);
      }

      // Use streaming to process the CSV in chunks...

      const records = await this.parseCsvStream(response.Body, year);

      logger.info(
        `Successfully parsed ${records.length} records for year ${year}`,
      );
      return records;
    } catch (error) {
      logger.error(`Failed to download and parse CSV for year ${year}`, {
        error: error instanceof Error ? error.message : String(error),
        bucket: this.bucketName,
        key: `${year}.annual.singlefile.csv`,
      });
      throw error;
    }
  }

  private async parseCsvStream(
    body: { transformToWebStream: () => ReadableStream },
    year: string,
  ): Promise<BlsCsvRecord[]> {
    const records: BlsCsvRecord[] = [];
    let headers: string[] = [];
    let lineNumber = 0;
    let buffer = '';

    // Convert body to async iterator for streaming...

    const stream = body.transformToWebStream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer..

          if (buffer.trim()) {
            const remainingLines = buffer.split('\n');
            for (const line of remainingLines) {
              if (line.trim()) {
                const record = this.parseCsvLine(line, headers, lineNumber);
                if (record && typeof record !== 'string') {
                  records.push(record);
                }
                lineNumber++;
              }
            }
          }
          break;
        }

        // Decode the chunk and add to buffer...

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines...

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer.

        for (const line of lines) {
          if (line.trim()) {
            if (lineNumber === 0) {
              // Parse headers...

              const headerResult = this.parseCsvLine(line, [], lineNumber);
              if (typeof headerResult === 'string') {
                headers = headerResult.split(',');
              }
              if (headers.length === 0) {
                throw new Error('CSV file is empty or has no headers');
              }
            } else {
              // Parse data record...

              const record = this.parseCsvLine(line, headers, lineNumber);
              if (record && typeof record !== 'string') {
                records.push(record);
              }
            }
            lineNumber++;
          }
        }

        // Memory management: limit buffer size...

        if (buffer.length > 1024 * 1024) {
          // 1MB limit.
          logger.warn(
            `Buffer size exceeded 1MB for year ${year}, processing remaining data`,
          );

          const remainingLines = buffer.split('\n');
          buffer = remainingLines.pop() || '';

          for (const line of remainingLines) {
            if (line.trim()) {
              const record = this.parseCsvLine(line, headers, lineNumber);
              if (record && typeof record !== 'string') {
                records.push(record);
              }
              lineNumber++;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return records;
  }

  private parseCsvLine(
    line: string,
    headers: string[],
    lineNumber: number,
  ): BlsCsvRecord | string | null {
    const values = this.parseCsvValues(line);

    if (lineNumber === 0) {
      // Return headers as string for first line...

      return values.join(',');
    }

    if (values.length !== headers.length) {
      logger.warn(
        `Skipping malformed line ${lineNumber + 1}: expected ${headers.length} columns, got ${values.length}`,
      );
      return null;
    }

    const record: BlsCsvRecord = {
      area_fips: values[0] || '',
      industry_code: values[1] || '',
      own_code: values[2] || '',
      agglvl_code: values[3] || '',
      size_code: values[4] || '',
      year: values[5] || '',
      annual_avg_emplvl: values[6] || '',
      annual_avg_estabs: values[7] || '',
      total_annual_wages: values[8] || '',
      taxable_annual_wages: values[9] || '',
      annual_contributions: values[10] || '',
      annual_avg_wkly_wage: values[11] || '',
      avg_annual_pay: values[12] || '',
      lq_annual_avg_emplvl: values[13] || '',
      lq_annual_avg_estabs: values[14] || '',
      lq_total_annual_wages: values[15] || '',
      lq_taxable_annual_wages: values[16] || '',
      lq_annual_contributions: values[17] || '',
      lq_annual_avg_wkly_wage: values[18] || '',
      lq_avg_annual_pay: values[19] || '',
      oty_total_annual_wages_pct: values[20] || '',
      oty_annual_avg_emplvl_pct: values[21] || '',
      oty_annual_avg_estabs_pct: values[22] || '',
    };

    return record;
  }

  private parseCsvValues(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());

    return values;
  }

  async getFileSize(year: string): Promise<number> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: `${year}.annual.singlefile.csv`,
        }),
      );

      return response.ContentLength || 0;
    } catch (error) {
      logger.error(`Failed to get file size for year ${year}`, {
        error: error instanceof Error ? error.message : String(error),
        bucket: this.bucketName,
        key: `${year}.annual.singlefile.csv`,
      });
      throw error;
    }
  }
}
