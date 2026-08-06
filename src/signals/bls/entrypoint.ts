import { BlsService } from '../../services/bls/bls-service';
import { logger } from '../../util';
import { publishSignalArtifacts } from '../shared-signal-publish';

async function main() {
  try {
    logger.info('Starting BLS signal task...');

    const blsService = new BlsService();
    await blsService.processBlsData();

    const physicalScores = await blsService.getAllPhysicalScores();
    const ecommerceScores = await blsService.getAllEcommerceScores();

    await publishSignalArtifacts(
      [
        {
          signalType: 'bls-physical',
          scores: physicalScores,
          s3Key: 'data/signals/bls-physical-scores.json',
          localFileName: 'bls-physical-scores.json',
          metadataSignal: 'BLS_PHYSICAL',
        },
        {
          signalType: 'bls-ecommerce',
          scores: ecommerceScores,
          s3Key: 'data/signals/bls-ecommerce-scores.json',
          localFileName: 'bls-ecommerce-scores.json',
          metadataSignal: 'BLS_ECOMMERCE',
        },
      ],
      { wrapLocalBody: false },
    );

    logger.info('SUCCESS: BLS signal task completed successfully!');
  } catch (err) {
    logger.error('BLS signal task failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
