#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { BlsService } from '../../src/services/bls/bls-service';
import { logger } from '../../src/util';

async function runBlsTest() {
  try {
    logger.info('Starting BLS signal test...');

    // Process BLS data and calculate signals
    const blsService = new BlsService();
    await blsService.processBlsData();

    // Get individual scores (both physical and e-commerce)
    const individualScores = await blsService.getAllIndividualScores();

    // Write individual scores to dev/scores/bls-scores.json...
    const scoresDir = path.resolve(__dirname, '../scores');
    const individualFilePath = path.join(scoresDir, 'bls-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(
      individualFilePath,
      JSON.stringify(individualScores, null, 2),
    );

    logger.info('BLS individual scores written to file:', {
      filePath: individualFilePath,
    });

    // Get combined scores for blockbuster index
    const combinedScores = await blsService.getAllScores();

    // Write combined scores to dev/scores/bls-scores-combined.json...
    const combinedFilePath = path.join(scoresDir, 'bls-scores-combined.json');
    fs.writeFileSync(combinedFilePath, JSON.stringify(combinedScores, null, 2));

    logger.info('BLS combined scores written to file:', {
      filePath: combinedFilePath,
    });
    logger.info('BLS signal test completed successfully!');
  } catch (error) {
    logger.error('BLS signal test failed:', error);
    process.exit(1);
  }
}

runBlsTest();
