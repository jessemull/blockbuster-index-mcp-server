import fs from 'fs';
import path from 'path';
import { CONFIG, validateConfig } from './config';
import { WEIGHTS } from './constants';
import {
  getAmazonScores,
  getCensusScores,
  getBroadbandScores,
} from './signals';
import {
  BlockbusterIndexResponse,
  Signal,
  StateScore,
  States,
  SignalConfig,
} from './types';
import { logger, retryWithBackoff, uploadToS3 } from './util';

export const main = async () => {
  const startTime = Date.now();

  const SIGNAL_CONFIGS: SignalConfig[] = [
    {
      name: 'Amazon',
      signal: Signal.AMAZON,
      getter: getAmazonScores,
    },
    {
      name: 'Census',
      signal: Signal.CENSUS,
      getter: getCensusScores,
    },
    {
      name: 'Broadband',
      signal: Signal.BROADBAND,
      getter: getBroadbandScores,
    },
  ];

  try {
    if (!CONFIG.IS_DEVELOPMENT) {
      validateConfig();
    }

    logger.info('Starting blockbuster index calculation');

    // Execute all signals with retry logic...

    const signalPromises = SIGNAL_CONFIGS.map((config) =>
      retryWithBackoff(config.getter),
    );

    const results = await Promise.allSettled(signalPromises);

    // Extract results and handle failures gracefully...

    const signalResults: Record<Signal, Record<string, number>> = {} as Record<
      Signal,
      Record<string, number>
    >;
    let failedSignals = 0;

    results.forEach((result, index) => {
      const config = SIGNAL_CONFIGS[index];

      if (result.status === 'fulfilled') {
        signalResults[config.signal] = result.value;
      } else {
        failedSignals++;
        logger.error(`${config.name} signal failed:`, result.reason);
        signalResults[config.signal] = {};
      }
    });

    // If all signals failed, we can't proceed...

    if (failedSignals === results.length) {
      throw new Error('All signals failed - cannot generate index');
    }

    logger.info('Signals fetched', {
      totalSignals: results.length,
      successfulSignals: results.length - failedSignals,
      failedSignals,
    });

    const states: Record<string, StateScore> = {};

    for (const state of Object.values(States)) {
      const components = {
        [Signal.AMAZON]: signalResults[Signal.AMAZON]?.[state] ?? 0,
        [Signal.CENSUS]: signalResults[Signal.CENSUS]?.[state] ?? 0,
        [Signal.BROADBAND]: signalResults[Signal.BROADBAND]?.[state] ?? 0,
      };

      const score = Object.entries(components).reduce(
        (sum, [signal, value]) => sum + value * WEIGHTS[signal as Signal],
        0,
      );

      states[state] = {
        score: parseFloat(score.toFixed(2)),
        components,
      };

      logger.info('Combined signal', {
        state,
        score: states[state].score,
        components,
      });
    }

    const response: BlockbusterIndexResponse = {
      states,
      metadata: {
        calculatedAt: new Date().toISOString(),
        version: CONFIG.VERSION,
        totalStates: Object.keys(states).length,
        signalStatus: {
          total: results.length,
          successful: results.length - failedSignals,
          failed: failedSignals,
        },
      },
    };

    const processingTime = Date.now() - startTime;

    logger.info('Blockbuster index calculation completed', {
      processingTime,
      totalStates: response.metadata.totalStates,
      signalStatus: response.metadata.signalStatus,
    });

    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../dev/scores');
      const filePath = path.join(scoresDir, 'blockbuster-index.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
      logger.info('File written', { filePath });
    } else {
      await retryWithBackoff(async () => {
        await uploadToS3({
          bucket: CONFIG.S3_BUCKET_NAME!,
          key: 'data/data.json',
          body: JSON.stringify(response, null, 2),
          metadata: {
            version: CONFIG.VERSION,
            calculatedAt: response.metadata.calculatedAt,
          },
        });
      });

      logger.info('S3 uploaded', {
        bucket: CONFIG.S3_BUCKET_NAME!,
        key: 'data/data.json',
      });
    }

    logger.info('Calculation completed!');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const duration = Date.now() - startTime;

    logger.error('Blockbuster index calculation failed:', {
      error: error.message,
      stack: error.stack,
      duration,
      environment: CONFIG.NODE_ENV,
    });

    process.exit(1);
  }
};
