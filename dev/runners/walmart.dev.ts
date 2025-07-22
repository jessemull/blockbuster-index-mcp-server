#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getWalmartScores } from '../../src/signals/walmart/get-walmart-scores';
import { logger } from '../../src/util';

async function runWalmartTest() {
  try {
    logger.info('Starting Walmart signal test...');

    // Get Walmart job counts and store data while scraping...

    const { scores } = await getWalmartScores();

    // Write scores to dev/scores/walmart-scores.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const filePath = path.join(scoresDir, 'walmart-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(scores, null, 2));

    logger.info('Walmart scores written to file:', { filePath });
    logger.info('Walmart signal test completed successfully!');
  } catch (error) {
    logger.error('Walmart signal test failed:', error);
    process.exit(1);
  }
}

runWalmartTest();
