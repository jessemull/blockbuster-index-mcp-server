# Environment Variables

This document lists all environment variables used by the blockbuster index MCP server.
Application code reads these only through `src/config/config.ts`.

## Amazon Signal

| Variable                           | Description                                   | Required | Default                                         |
| ---------------------------------- | --------------------------------------------- | -------- | ----------------------------------------------- |
| `AMAZON_DYNAMODB_TABLE_NAME`       | DynamoDB table for Amazon job signal records  | Prod yes | `blockbuster-index-amazon-jobs-dev` (call-site) |
| `AMAZON_SLIDING_WINDOW_TABLE_NAME` | DynamoDB table for Amazon sliding window data | No       | `blockbuster-index-amazon-sliding-window-dev`   |

## Walmart Signal

| Variable                                     | Description                                    | Required | Default                                          |
| -------------------------------------------- | ---------------------------------------------- | -------- | ------------------------------------------------ |
| `WALMART_DYNAMODB_TABLE_NAME`                | DynamoDB table for Walmart job signal records  | Prod yes | `blockbuster-index-walmart-jobs-dev` (call-site) |
| `WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME` | DynamoDB table for Walmart sliding window data | No       | `blockbuster-index-walmart-sliding-window-dev`   |

## Broadband Signal

| Variable                        | Description                                 | Required | Default                                               |
| ------------------------------- | ------------------------------------------- | -------- | ----------------------------------------------------- |
| `BROADBAND_DYNAMODB_TABLE_NAME` | DynamoDB table for broadband signal records | Prod yes | `blockbuster-index-broadband-signals-dev` (call-site) |
| `BROADBAND_S3_BUCKET`           | S3 bucket for broadband CSV source data     | No       | `blockbuster-index-broadband-dev`                     |

## Census Signal

| Variable                     | Description                              | Required | Default                                            |
| ---------------------------- | ---------------------------------------- | -------- | -------------------------------------------------- |
| `CENSUS_DYNAMODB_TABLE_NAME` | DynamoDB table for census signal records | Prod yes | `blockbuster-index-census-signals-dev` (call-site) |
| `FORCE_REFRESH`              | Force census refresh when `true`         | No       | `false`                                            |

## BLS Signal

| Variable                         | Description                              | Required | Default                                     |
| -------------------------------- | ---------------------------------------- | -------- | ------------------------------------------- |
| `BLS_PROCESSED_FILES_TABLE_NAME` | DynamoDB table for processed BLS files   | No       | `blockbuster-index-bls-processed-files-dev` |
| `BLS_STATE_DATA_TABLE_NAME`      | DynamoDB table for BLS state time series | No       | `blockbuster-index-bls-state-data-dev`      |
| `BLS_SIGNALS_TABLE_NAME`         | DynamoDB table for BLS signal scores     | No       | `blockbuster-index-bls-signals-dev`         |
| `BLS_S3_BUCKET`                  | S3 bucket for BLS source files           | No       | `blockbuster-index-bls-dev`                 |

## Signal Scores

| Variable                            | Description                      | Required | Default |
| ----------------------------------- | -------------------------------- | -------- | ------- |
| `SIGNAL_SCORES_DYNAMODB_TABLE_NAME` | DynamoDB table for signal scores | Prod yes | -       |

## Blockbuster Index

| Variable                                | Description                                  | Required | Default |
| --------------------------------------- | -------------------------------------------- | -------- | ------- |
| `BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME` | DynamoDB table for blockbuster index records | Prod yes | -       |

## AWS Configuration

| Variable         | Description                    | Required | Default     |
| ---------------- | ------------------------------ | -------- | ----------- |
| `AWS_REGION`     | AWS region for all services    | No       | `us-west-2` |
| `S3_BUCKET_NAME` | S3 bucket for published scores | Yes      | -           |

## Scraping

| Variable                    | Description                           | Required | Default |
| --------------------------- | ------------------------------------- | -------- | ------- |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium binary path (ECS/Docker)     | No       | -       |
| `MAX_RETRIES`               | Retry attempts for transient failures | No       | `3`     |
| `RETRY_DELAY`               | Base retry delay in ms                | No       | `1000`  |

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

## GitHub Actions (deploy + run-task workflows)

Set these as repository or environment **Variables** (not secrets) for `deploy.yml` and `run-task.yml`:

| Variable               | Description                                         | Example                 |
| ---------------------- | --------------------------------------------------- | ----------------------- |
| `ECS_SUBNETS`          | Comma-separated subnet IDs for Fargate tasks        | `subnet-abc,subnet-def` |
| `ECS_SECURITY_GROUPS`  | Comma-separated security group IDs                  | `sg-abc`                |
| `ECS_ASSIGN_PUBLIC_IP` | `ENABLED` or `DISABLED` (optional, default ENABLED) | `ENABLED`               |
