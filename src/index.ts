import fs from 'fs';
import path from 'path';
import { Signal, States } from './types';
import { WEIGHTS } from './constants';
import {
  getAmazonScores,
  getAnalogScores,
  getBroadbandScores,
  getCommerceScores,
  getPhysicalScores,
  getStreamingScores,
  getWalmartScores,
} from './signals';
import { logger } from './util';

const isDevelopment =
  process.env.NODE_ENV === 'development' ||
  process.env.LOCAL_DEVELOPMENT === 'true';

async function main() {
  try {
    const [amazon, analog, broadband, ecommerce, media, streaming, walmart] =
      await Promise.all([
        getAmazonScores(),
        getAnalogScores(),
        getBroadbandScores(),
        getCommerceScores(),
        getPhysicalScores(),
        getStreamingScores(),
        getWalmartScores(),
      ]);

    const response: Record<
      States,
      { score: number; components: Record<Signal, number> }
    > = {} as Record<
      States,
      { score: number; components: Record<Signal, number> }
    >;

    for (const state of Object.values(States)) {
      const components = {
        [Signal.AMAZON]: amazon[state] ?? 0,
        [Signal.ANALOG]: analog[state] ?? 0,
        [Signal.BROADBAND]: broadband[state] ?? 0,
        [Signal.ECOMMERCE]: ecommerce[state] ?? 0,
        [Signal.PHYSICAL]: media[state] ?? 0,
        [Signal.STREAMING]: streaming[state] ?? 0,
        [Signal.WALMART]: walmart[state] ?? 0,
      };

      const score = Object.entries(components).reduce(
        (sum, [signal, value]) => sum + value * WEIGHTS[signal as Signal],
        0,
      );

      response[state] = {
        score: parseFloat(score.toFixed(2)),
        components,
      };
    }

    if (isDevelopment) {
      const scoresDir = path.resolve(__dirname, '../dev/scores');
      const filePath = path.join(scoresDir, 'blockbuster-index.json');
      await fs.mkdirSync(scoresDir, { recursive: true });
      await fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
      logger.info(`Combined scores written to: ${filePath}...`);
    } else {
      logger.info(JSON.stringify(response, null, 2));
    }
  } catch (err) {
    logger.error(
      'Blockbuster index calculation failed: ',
      (err as Error).message,
    );
    process.exit(1);
  }
}

// Only run if this script is called directly...

if (require.main === module) {
  main();
}
