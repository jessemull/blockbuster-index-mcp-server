const {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'us-west-2' });

async function clearSignalsTable() {
  console.log('Clearing blockbuster-index-bls-signals-dev table...');

  try {
    // Scan to get all items
    const scanCommand = new ScanCommand({
      TableName: 'blockbuster-index-bls-signals-dev',
      AttributesToGet: ['state_fips', 'timestamp'],
    });

    const scanResult = await client.send(scanCommand);
    const items = scanResult.Items || [];

    console.log(`Found ${items.length} items to delete`);

    // Delete each item
    let deletedCount = 0;
    for (const item of items) {
      try {
        const deleteCommand = new DeleteItemCommand({
          TableName: 'blockbuster-index-bls-signals-dev',
          Key: {
            state_fips: item.state_fips,
            timestamp: item.timestamp,
          },
        });

        await client.send(deleteCommand);
        deletedCount++;

        if (deletedCount % 10 === 0) {
          console.log(`Deleted ${deletedCount} items...`);
        }
      } catch (error) {
        console.error(`Error deleting item:`, error.message);
      }
    }

    console.log(
      `Successfully deleted ${deletedCount} items from signals table`,
    );
  } catch (error) {
    console.error('Error clearing signals table:', error);
  }
}

clearSignalsTable().catch(console.error);
