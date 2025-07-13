#!/usr/bin/env ts-node

import { getBroadbandScores } from '../../src/signals/broadband/get-broadband-scores';
import { logger } from '../../src/util';

async function runBroadbandTest() {
  try {
    logger.info('Starting broadband signal test...');

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
        Object.values(scores).reduce((sum, score) => sum + score, 0) /
        Object.values(scores).length,
    });

    logger.info('Broadband signal test completed successfully!');
  } catch (error) {
    logger.error('Broadband signal test failed:', error);
    process.exit(1);
  }
}

runBroadbandTest();
