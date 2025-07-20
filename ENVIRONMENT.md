# Environment Variables

This document lists all environment variables used by the blockbuster index MCP server.

## Amazon Signal

| Variable                                    | Description                                         | Required | Default |
| ------------------------------------------- | --------------------------------------------------- | -------- | ------- |
| `AMAZON_PHYSICAL_DYNAMODB_TABLE_NAME`       | DynamoDB table for Amazon physical job records      | Yes      | -       |
| `AMAZON_TECHNOLOGY_DYNAMODB_TABLE_NAME`     | DynamoDB table for Amazon technology job records    | Yes      | -       |
| `AMAZON_SLIDING_WINDOW_DYNAMODB_TABLE_NAME` | DynamoDB table for Amazon sliding window aggregates | Yes      | -       |

## Walmart Signal

| Variable                                     | Description                                          | Required | Default |
| -------------------------------------------- | ---------------------------------------------------- | -------- | ------- |
| `WALMART_PHYSICAL_DYNAMODB_TABLE_NAME`       | DynamoDB table for Walmart physical job records      | Yes      | -       |
| `WALMART_TECHNOLOGY_DYNAMODB_TABLE_NAME`     | DynamoDB table for Walmart technology job records    | Yes      | -       |
| `WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME` | DynamoDB table for Walmart sliding window aggregates | Yes      | -       |

## Broadband Signal

| Variable                               | Description                                 | Required | Default |
| -------------------------------------- | ------------------------------------------- | -------- | ------- |
| `BROADBAND_SIGNAL_DYNAMODB_TABLE_NAME` | DynamoDB table for broadband signal records | Yes      | -       |

## Census Signal

| Variable                            | Description                              | Required | Default |
| ----------------------------------- | ---------------------------------------- | -------- | ------- |
| `CENSUS_SIGNAL_DYNAMODB_TABLE_NAME` | DynamoDB table for census signal records | Yes      | -       |

## Signal Scores

| Variable                            | Description                      | Required | Default |
| ----------------------------------- | -------------------------------- | -------- | ------- |
| `SIGNAL_SCORES_DYNAMODB_TABLE_NAME` | DynamoDB table for signal scores | No       | -       |

## Blockbuster Index

| Variable                                | Description                                  | Required | Default |
| --------------------------------------- | -------------------------------------------- | -------- | ------- |
| `BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME` | DynamoDB table for blockbuster index records | Yes      | -       |

## AWS Configuration

| Variable         | Description                 | Required | Default     |
| ---------------- | --------------------------- | -------- | ----------- |
| `AWS_REGION`     | AWS region for all services | No       | `us-west-2` |
| `S3_BUCKET_NAME` | S3 bucket for data storage  | Yes      | -           |

## Logging

| Variable        | Description           | Required | Default                                    |
| --------------- | --------------------- | -------- | ------------------------------------------ |
| `LOG_LEVEL`     | Logging level         | No       | `info`                                     |
| `CW_LOG_GROUP`  | CloudWatch log group  | No       | `/aws/ecs/blockbuster-index-mcp-log-group` |
| `CW_LOG_STREAM` | CloudWatch log stream | No       | `blockbuster-index-mcp-${AWS_TASK_ID}`     |

## Application

| Variable        | Description          | Required | Default       |
| --------------- | -------------------- | -------- | ------------- |
| `NODE_ENV`      | Node.js environment  | No       | `development` |
| `CACHE_CONTROL` | Cache control header | No       | `max-age=300` |
