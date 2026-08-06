import { logger } from '../../util';
import { publishSignalArtifacts } from '../shared-signal-publish';
import { getCensusScores } from './get-census-scores';

async function main() {
  try {
    logger.info('Starting Census signal task...');
    const scores = await getCensusScores();

    await publishSignalArtifacts([
      {
        signalType: 'census',
        scores,
        s3Key: 'data/signals/census-scores.json',
        localFileName: 'census-scores.json',
        metadataSignal: 'CENSUS',
      },
    ]);

    logger.info('SUCCESS: Census signal task completed successfully!');
  } catch (err) {
    logger.error('Census signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
