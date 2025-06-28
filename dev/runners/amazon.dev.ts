import { DynamoDBJobSignalRepository } from '../../src/repositories/DynamoDBJobSignalRepository';
import { scrapeAmazonJobs } from '../../src/signals/amazon';

(async () => {
  try {
    // Initialize the repository with your DynamoDB table name
    const region = process.env.AWS_REGION || 'us-west-2';
    const tableName =
      process.env.DYNAMODB_TABLE_NAME || 'blockbuster-index-amazon-jobs-dev';

    console.log('Starting Amazon signal collection and storage...');
    console.log(`Region: ${region}`);
    console.log(`Table: ${tableName}`);

    const repository = new DynamoDBJobSignalRepository(tableName, region);

    // Get current timestamp for start of day
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const timestamp = Math.floor(startOfDay.getTime() / 1000);

    // Get Amazon job counts and store data while scraping
    const jobCounts = await scrapeAmazonJobs(repository, timestamp);

    console.log('Amazon signal collection and storage completed successfully!');
    console.log(
      `Total jobs found: ${Object.values(jobCounts).reduce((sum, count) => sum + count, 0)}`,
    );
    console.log(`Total states processed: ${Object.keys(jobCounts).length}`);
  } catch (error: unknown) {
    console.error(
      'Failed to store Amazon signals:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
})();
