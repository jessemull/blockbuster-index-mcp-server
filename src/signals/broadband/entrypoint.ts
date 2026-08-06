import { logger } from '../../util';
import { publishSignalArtifacts } from '../shared-signal-publish';
import { getBroadbandScores } from './get-broadband-scores';

async function main() {
  try {
    logger.info('Starting Broadband signal task...');
    const scores = await getBroadbandScores();

    await publishSignalArtifacts([
      {
        signalType: 'broadband',
        scores,
        s3Key: 'data/signals/broadband-scores.json',
        localFileName: 'broadband-scores.json',
        metadataSignal: 'BROADBAND',
      },
    ]);

    logger.info('SUCCESS: Broadband signal task completed successfully!');
  } catch (err) {
    logger.error('Broadband signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
