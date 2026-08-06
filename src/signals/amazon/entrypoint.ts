import { logger } from '../../util';
import { publishSignalArtifacts } from '../shared-signal-publish';
import { getAmazonScores } from './get-amazon-scores';

async function main() {
  try {
    logger.info('Starting Amazon signal task...');
    const scores = await getAmazonScores();

    await publishSignalArtifacts([
      {
        signalType: 'amazon',
        scores,
        s3Key: 'data/signals/amazon-scores.json',
        localFileName: 'amazon-scores.json',
        metadataSignal: 'AMAZON',
      },
    ]);

    logger.info('SUCCESS: Amazon signal task completed successfully!');
  } catch (err) {
    logger.error('Amazon signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
