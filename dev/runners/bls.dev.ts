import { getBlsScores } from '../../src/signals/bls';
import { logger } from '../../src/util';

async function main() {
  try {
    logger.info('Starting BLS dev runner...');

    const scores = await getBlsScores();

    logger.info('BLS scores calculated:', scores);
    logger.info('BLS dev runner completed successfully!');
  } catch (error) {
    logger.error('BLS dev runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
