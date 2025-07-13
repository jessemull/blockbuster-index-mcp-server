#!/usr/bin/env ts-node

import path from 'path';
import { BroadbandService } from '../../src/services/broadband-service';
import { logger } from '../../src/util';

async function runBroadbandTest() {
  try {
    logger.info('Starting broadband signal test...');

    const service = new BroadbandService();
    const csvPath = path.resolve(__dirname, '../../AK-Fixed-Jun2021-v1.csv');

    logger.info(`Processing CSV file: ${csvPath}`);

    const metrics = await service.processBroadbandCsv(csvPath);

    logger.info('Broadband metrics calculated:', {
      statesProcessed: Object.keys(metrics).length,
      metrics: JSON.stringify(metrics, null, 2),
    });

    // Focus on Alaska results
    if (metrics.AK) {
      logger.info('Alaska broadband metrics:', {
        totalBlocks: metrics.AK.totalCensusBlocks,
        broadbandAvailability: `${metrics.AK.broadbandAvailabilityPercent}%`,
        highSpeedAvailability: `${metrics.AK.highSpeedAvailabilityPercent}%`,
        gigabitAvailability: `${metrics.AK.gigabitAvailabilityPercent}%`,
        averageSpeed: `${metrics.AK.averageDownloadSpeed} Mbps`,
        medianSpeed: `${metrics.AK.medianDownloadSpeed} Mbps`,
        finalScore: metrics.AK.broadbandScore,
        technologyCounts: metrics.AK.technologyCounts,
      });
    }

    logger.info('Broadband test completed successfully!');
  } catch (error) {
    logger.error('Broadband test failed:', error);
    process.exit(1);
  }
}

runBroadbandTest();
