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

    // Get both physical and e-commerce scores
    const physicalScores = await blsService.getAllPhysicalScores();
    const ecommerceScores = await blsService.getAllEcommerceScores();

    // Write physical scores to dev/scores/bls-physical-scores.json
    const scoresDir = path.resolve(__dirname, '../scores');
    const physicalFilePath = path.join(scoresDir, 'bls-physical-scores.json');
    const ecommerceFilePath = path.join(scoresDir, 'bls-ecommerce-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(physicalFilePath, JSON.stringify(physicalScores, null, 2));
    fs.writeFileSync(
      ecommerceFilePath,
      JSON.stringify(ecommerceScores, null, 2),
    );

    logger.info('BLS signals written to files:', {
      physicalFilePath,
      ecommerceFilePath,
    });
    logger.info('BLS signal test completed successfully!');
  } catch (error) {
    logger.error('BLS signal test failed:', error);
    process.exit(1);
  }
}

runBlsTest();
