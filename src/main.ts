import fs from 'fs';
import path from 'path';
import { CONFIG, validateConfig } from './config';
import { WEIGHTS } from './constants';
import { getAmazonScores, getCensusScores } from './signals';
import { BlockbusterIndexResponse, Signal, StateScore, States } from './types';
import { logger, retryWithBackoff, uploadToS3 } from './util';

export const main = async () => {
  const startTime = Date.now();

  try {
    if (!CONFIG.IS_DEVELOPMENT) {
      validateConfig();
    }

    logger.startOperation('blockbuster_index_calculation');
    logger.performance('calculation_start', Date.now() - startTime);

    const [amazon, census] = await Promise.all([
      retryWithBackoff(() => getAmazonScores()),
      retryWithBackoff(() => getCensusScores()),
    ]);

    logger.performance('signals_fetched', Date.now() - startTime, {
      totalSignals: 2,
    });

    const states: Record<string, StateScore> = {};

    for (const state of Object.values(States)) {
      const components = {
        [Signal.AMAZON]: amazon[state] ?? 0,
        [Signal.CENSUS]: census[state] ?? 0,
      };

      const score = Object.entries(components).reduce(
        (sum, [signal, value]) => sum + value * WEIGHTS[signal as Signal],
        0,
      );

      states[state] = {
        score: parseFloat(score.toFixed(2)),
        components,
      };

      logger.signal('combined', state, states[state].score, { components });
    }

    const response: BlockbusterIndexResponse = {
      states,
      metadata: {
        calculatedAt: new Date().toISOString(),
        version: CONFIG.VERSION,
        totalStates: Object.keys(states).length,
      },
    };

    const processingTime = Date.now() - startTime;

    logger.endOperation('blockbuster_index_calculation', processingTime);
    logger.performance('index_calculation', processingTime, {
      totalStates: response.metadata.totalStates,
    });

    if (CONFIG.IS_DEVELOPMENT) {
      const scoresDir = path.resolve(__dirname, '../dev/scores');
      const filePath = path.join(scoresDir, 'blockbuster-index.json');
      fs.mkdirSync(scoresDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
      logger.performance('file_written', Date.now() - startTime, { filePath });
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

      logger.performance('s3_uploaded', Date.now() - startTime, {
        bucket: CONFIG.S3_BUCKET_NAME,
        key: 'data/data.json',
      });
    }

    logger.performance('calculation_completed', Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const duration = Date.now() - startTime;

    // Sanitize the error to prevent large objects from being logged
    const sanitizedError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };

    logger.errorWithContext(
      'Blockbuster index calculation failed:',
      sanitizedError as Error,
      {
        duration,
        environment: CONFIG.NODE_ENV,
      },
    );

    process.exit(1);
  }
};
