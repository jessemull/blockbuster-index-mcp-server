const {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'us-west-2' });

async function clearTable(tableName, keyAttribute) {
  console.log(`Clearing table: ${tableName}`);

  let deletedCount = 0;
  let lastEvaluatedKey = null;

  do {
    // Scan for items
    const scanParams = {
      TableName: tableName,
      AttributesToGet: [keyAttribute],
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    };

    const scanResult = await client.send(new ScanCommand(scanParams));
    lastEvaluatedKey = scanResult.LastEvaluatedKey;

    if (scanResult.Items && scanResult.Items.length > 0) {
      // Delete items one by one (more reliable than batch)
      for (const item of scanResult.Items) {
        const deleteParams = {
          TableName: tableName,
          Key: { [keyAttribute]: item[keyAttribute] },
        };

        try {
          await client.send(new DeleteItemCommand(deleteParams));
          deletedCount++;

          if (deletedCount % 100 === 0) {
            console.log(`Deleted ${deletedCount} items from ${tableName}...`);
          }
        } catch (error) {
          console.error(`Error deleting item:`, error);
        }
      }
    }
  } while (lastEvaluatedKey);

  console.log(
    `Completed clearing ${tableName}. Total deleted: ${deletedCount}`,
  );
}

async function main() {
  try {
    // Clear both tables
    await clearTable('blockbuster-index-bls-state-data-dev', 'state_year');
    await clearTable('blockbuster-index-bls-signals-dev', 'state_fips');

    console.log('All tables cleared successfully!');
  } catch (error) {
    console.error('Error clearing tables:', error);
  }
}

main();
