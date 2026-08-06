import { logger } from '../../util';
import { publishSignalArtifacts } from '../shared-signal-publish';
import { getWalmartScores } from './get-walmart-scores';

async function main() {
  try {
    logger.info('Starting Walmart signal task...');
    const { scores } = await getWalmartScores();

    await publishSignalArtifacts([
      {
        signalType: 'walmart',
        scores,
        s3Key: 'data/signals/walmart-scores.json',
        localFileName: 'walmart-scores.json',
        metadataSignal: 'WALMART',
      },
    ]);

    logger.info('SUCCESS: Walmart signal task completed successfully!');
  } catch (err) {
    logger.error('Walmart signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
