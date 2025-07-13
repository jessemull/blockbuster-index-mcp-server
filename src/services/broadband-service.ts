import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { logger } from '../util';
import { States } from '../types';
import {
  BroadbandCsvRecord,
  BroadbandMetrics,
  TechnologyCounts,
} from '../types/broadband';
import { TECHNOLOGY_CODES, SPEED_THRESHOLDS } from '../constants/broadband';

export class BroadbandService {
  // Process a broadband CSV file and extract metrics for all states...

  async processBroadbandCsv(
    filePath: string,
  ): Promise<Record<string, BroadbandMetrics>> {
    logger.info('Processing broadband CSV file', { filePath });

    if (!fs.existsSync(filePath)) {
      throw new Error(`Broadband CSV file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records: BroadbandCsvRecord[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    logger.info(`Parsed ${records.length} broadband records from CSV`);

    // Group records by state...

    const recordsByState = this.groupRecordsByState(records);

    // Calculate metrics for each state...

    const metricsMap: Record<string, BroadbandMetrics> = {};

    for (const [state, stateRecords] of Object.entries(recordsByState)) {
      if (Object.values(States).includes(state as States)) {
        metricsMap[state] = this.calculateBroadbandMetrics(stateRecords);
        logger.info(`Calculated broadband metrics for ${state}`, {
          totalBlocks: metricsMap[state].totalCensusBlocks,
          availabilityPercent: metricsMap[state].broadbandAvailabilityPercent,
          score: metricsMap[state].broadbandScore,
        });
      }
    }

    logger.info(
      `Processed broadband metrics for ${Object.keys(metricsMap).length} states`,
    );
    return metricsMap;
  }

  // Group CSV records by state...

  private groupRecordsByState(
    records: BroadbandCsvRecord[],
  ): Record<string, BroadbandCsvRecord[]> {
    const grouped: Record<string, BroadbandCsvRecord[]> = {};

    for (const record of records) {
      const state = record.StateAbbr?.trim();
      if (state) {
        if (!grouped[state]) {
          grouped[state] = [];
        }
        grouped[state].push(record);
      }
    }

    return grouped;
  }

  // Calculate broadband metrics for a single state...

  private calculateBroadbandMetrics(
    records: BroadbandCsvRecord[],
  ): BroadbandMetrics {
    // Get unique census blocks...

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
      broadbandScore: Math.round(broadbandScore * 10000) / 10000,
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
}
