const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

async function clearTable(tableName) {
  console.log(`Clearing table: ${tableName}`);

  try {
    let projectionExpression, expressionAttributeNames;

    // Set up projection based on table schema
    if (tableName.includes('processed-files')) {
      projectionExpression = '#year';
      expressionAttributeNames = { '#year': 'year' };
    } else if (tableName.includes('state-data')) {
      projectionExpression = '#state_year';
      expressionAttributeNames = { '#state_year': 'state_year' };
    } else if (tableName.includes('signals')) {
      projectionExpression = '#state_fips, #timestamp';
      expressionAttributeNames = {
        '#state_fips': 'state_fips',
        '#timestamp': 'timestamp',
      };
    }

    // Scan all items
    const scanResponse = await client.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: projectionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
      }),
    );

    if (!scanResponse.Items || scanResponse.Items.length === 0) {
      console.log(`Table ${tableName} is already empty`);
      return;
    }

    console.log(`Found ${scanResponse.Items.length} items to delete`);

    // Delete items in batches
    const batchSize = 25;
    for (let i = 0; i < scanResponse.Items.length; i += batchSize) {
      const batch = scanResponse.Items.slice(i, i + batchSize);

      const deleteRequests = batch.map((item) => {
        if (tableName.includes('processed-files')) {
          return {
            DeleteRequest: {
              Key: { year: item.year },
            },
          };
        } else if (tableName.includes('state-data')) {
          return {
            DeleteRequest: {
              Key: { state_year: item.state_year },
            },
          };
        } else if (tableName.includes('signals')) {
          return {
            DeleteRequest: {
              Key: {
                state_fips: item.state_fips,
                timestamp: item.timestamp,
              },
            },
          };
        }
      });

      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: deleteRequests,
          },
        }),
      );

      console.log(
        `Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(scanResponse.Items.length / batchSize)}`,
      );
    }

    console.log(`Successfully cleared table: ${tableName}`);
  } catch (error) {
    console.error(`Error clearing table ${tableName}:`, error);
  }
}

async function main() {
  const tables = [
    'blockbuster-index-bls-processed-files-dev',
    'blockbuster-index-bls-state-data-dev',
    'blockbuster-index-bls-signals-dev',
  ];

  console.log('Clearing BLS tables...');

  for (const table of tables) {
    await clearTable(table);
  }

  console.log('All BLS tables cleared successfully!');
}

main().catch(console.error);
