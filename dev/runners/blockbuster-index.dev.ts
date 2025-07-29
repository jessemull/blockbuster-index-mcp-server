#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { SIGNALS } from '../../src/constants/signals';
import { Signal } from '../../src/types';
import { logger } from '../../src/util';
import { calculateBlockbusterIndex } from '../../src/signals/blockbuster-index/calculate';

async function getSignalScores(
  signalName: string,
): Promise<Record<string, number>> {
  const scoresDir = path.resolve(__dirname, '../scores');

  // Special case for BLS: read from combined scores file
  const fileName =
    signalName === 'bls'
      ? 'bls-scores-combined.json'
      : `${signalName}-scores.json`;
  const filePath = path.join(scoresDir, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing local file for ${signalName}: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error(`JSON parse error for ${filePath}:`, e);
    throw e;
  }

  return parsed;
}

async function runBlockbusterIndexDev() {
  try {
    logger.info('Starting blockbuster index dev runner...');

    const signalResults: Record<Signal, Record<string, number>> = {} as Record<
      Signal,
      Record<string, number>
    >;

    for (const { name, signal } of SIGNALS) {
      signalResults[signal] = await getSignalScores(name);
    }

    // Calculate the final indices...

    const response = calculateBlockbusterIndex(signalResults, 'dev');

    // Write output to dev/scores/blockbuster-index.json...

    const scoresDir = path.resolve(__dirname, '../scores');
    const filePath = path.join(scoresDir, 'blockbuster-index.json');

    fs.mkdirSync(scoresDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

    logger.info('Blockbuster index written to file:', { filePath });
    logger.info('Blockbuster index dev runner completed successfully!');
  } catch (error) {
    logger.error('Blockbuster index dev runner failed:', error);
    process.exit(1);
  }
}

runBlockbusterIndexDev();
