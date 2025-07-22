#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { getWalmartScores } from '../../src/signals/walmart/get-walmart-scores';
import { logger } from '../../src/util';

async function runWalmartTest() {
  try {
    logger.info('Starting Walmart signal test...');

    // Get Walmart job counts and store data while scraping...

    const scores = await getWalmartScores();

    logger.info('Walmart signal results:', {
      totalStates: Object.keys(scores.physicalScores).length,
      physicalStatesWithData: Object.values(scores.physicalScores).filter(
        (score) => score > 0,
      ).length,
      technologyStatesWithData: Object.values(scores.technologyScores).filter(
        (score) => score > 0,
      ).length,
      samplePhysicalScores: Object.entries(scores.physicalScores)
        .filter(([, score]) => score > 0)
        .slice(0, 5)
        .reduce((acc, [state, score]) => ({ ...acc, [state]: score }), {}),
      sampleTechnologyScores: Object.entries(scores.technologyScores)
        .filter(([, score]) => score > 0)
        .slice(0, 5)
        .reduce((acc, [state, score]) => ({ ...acc, [state]: score }), {}),
      averagePhysicalScore:
        Object.values(scores.physicalScores).filter((score) => score > 0)
          .length > 0
          ? Object.values(scores.physicalScores)
              .filter((score) => score > 0)
              .reduce((sum, score) => sum + score, 0) /
            Object.values(scores.physicalScores).filter((score) => score > 0)
              .length
          : 0,
      averageTechnologyScore:
        Object.values(scores.technologyScores).filter((score) => score > 0)
          .length > 0
          ? Object.values(scores.technologyScores)
              .filter((score) => score > 0)
              .reduce((sum, score) => sum + score, 0) /
            Object.values(scores.technologyScores).filter((score) => score > 0)
              .length
          : 0,
    });

    // Write physical scores to dev/scores/walmart-physical-scores.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const physicalFilePath = path.join(
      scoresDir,
      'walmart-physical-scores.json',
    );
    const technologyFilePath = path.join(
      scoresDir,
      'walmart-technology-scores.json',
    );

    fs.mkdirSync(scoresDir, { recursive: true });

    fs.writeFileSync(
      physicalFilePath,
      JSON.stringify(scores.physicalScores, null, 2),
    );
    fs.writeFileSync(
      technologyFilePath,
      JSON.stringify(scores.technologyScores, null, 2),
    );

    logger.info('Walmart physical scores written to file:', {
      filePath: physicalFilePath,
    });
    logger.info('Walmart technology scores written to file:', {
      filePath: technologyFilePath,
    });
    logger.info('Walmart signal test completed successfully!');
  } catch (error) {
    logger.error('Walmart signal test failed:', error);
    process.exit(1);
  }
}

runWalmartTest();
