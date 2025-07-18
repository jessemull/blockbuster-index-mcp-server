#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getAmazonScores } from '../../src/signals/amazon/get-amazon-scores';
import { logger } from '../../src/util';

async function runAmazonTest() {
  try {
    logger.info('Starting Amazon signal test...');

    // Get Amazon job counts and store data while scraping...

    const scores = await getAmazonScores();

    logger.info('Amazon signal results:', {
      totalStates: Object.keys(scores).length,
      statesWithData: Object.values(scores).filter((score) => score > 0).length,
      sampleScores: Object.entries(scores)
        .filter(([, score]) => score > 0)
        .slice(0, 5)
        .reduce((acc, [state, score]) => ({ ...acc, [state]: score }), {}),
      averageScore:
        Object.values(scores).filter((score) => score > 0).length > 0
          ? Object.values(scores)
              .filter((score) => score > 0)
              .reduce((sum, score) => sum + score, 0) /
            Object.values(scores).filter((score) => score > 0).length
          : 0,
    });

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
