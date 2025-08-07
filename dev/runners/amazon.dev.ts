#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getAmazonScores } from '../../src/signals/amazon/get-amazon-scores';
import { logger } from '../../src/util';

async function runAmazonTest() {
  try {
    logger.info('Starting Amazon signal test...');

    // Get Amazon job counts...

    const scores = await getAmazonScores();

    // Write scores to dev/scores/amazon-scores.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const filePath = path.join(scoresDir, 'amazon-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(scores, null, 2));

    logger.info('Amazon scores written to file:', { filePath });
    logger.info('Amazon signal test completed successfully!');
  } catch (error) {
    logger.error('Amazon signal test failed:', error);
    process.exit(1);
  }
}

runAmazonTest();
