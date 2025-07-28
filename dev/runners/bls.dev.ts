#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getBlsScores } from '../../src/signals/bls/get-bls-scores';
import { logger } from '../../src/util';

async function runBlsTest() {
  try {
    logger.info('Starting BLS signal test...');

    // Get BLS scores and store data while processing...

    const scores = await getBlsScores();

    // Write scores to dev/scores/bls-scores.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const filePath = path.join(scoresDir, 'bls-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(scores, null, 2));

    logger.info('BLS scores written to file:', { filePath });
    logger.info('BLS signal test completed successfully!');
  } catch (error) {
    logger.error('BLS signal test failed:', error);
    process.exit(1);
  }
}

runBlsTest();
