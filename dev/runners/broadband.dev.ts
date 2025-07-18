#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getBroadbandScores } from '../../src/signals/broadband/get-broadband-scores';
import { BroadbandService } from '../../src/services';
import { logger } from '../../src/util';

async function runBroadbandTest() {
  try {
    logger.info('Starting broadband signal test...');

    // Process broadband data and write to DynamoDB...

    const broadbandService = new BroadbandService();
    await broadbandService.processBroadbandData();

    // Get FCC broadband data while scraping...

    const scores = await getBroadbandScores();

    logger.info('Broadband signal results:', {
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

    // Write scores to dev/scores/broadband-scores.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const filePath = path.join(scoresDir, 'broadband-scores.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(scores, null, 2));

    logger.info('Broadband scores written to file', { filePath });
    logger.info('Broadband signal test completed successfully!');
  } catch (error) {
    logger.error('Broadband signal test failed:', error);
    process.exit(1);
  }
}

runBroadbandTest();
