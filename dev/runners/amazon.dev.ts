import { getAmazonScores } from '../../src/signals';

(async () => {
  try {
    console.log('Starting Amazon signal collection and storage...');

    // Get Amazon job counts and store data while scraping...

    const scores = await getAmazonScores();

    console.log('Amazon signal collection and storage completed successfully!');
    console.log(
      `Total jobs found: ${Object.values(scores).reduce((sum, count) => sum + count, 0)}`,
    );
    console.log(`Total states processed: ${Object.keys(scores).length}`);
  } catch (error: unknown) {
    console.error(
      'Failed to store Amazon signals:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
})();
