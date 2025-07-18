#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getCensusScores } from '../../src/signals/census/get-census-scores';
import { logger } from '../../src/util';

async function runCensusTest() {
  try {
    logger.info('Starting Census signal test...');

    const scores = await getCensusScores();

    logger.info('Census signal results:', {
      totalStates: Object.keys(scores).length,
      statesWithData: Object.values(scores).filter((score) => score > 0).length,
    });

    // Write scores to dev/scores/census-scores.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const filePath = path.join(scoresDir, 'census-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(scores, null, 2));

    logger.info('Census scores written to file:', { filePath });
    logger.info('Census signal test completed successfully!');
  } catch (error) {
    logger.error('Census signal test failed:', error);
    process.exit(1);
  }
}

runCensusTest();
