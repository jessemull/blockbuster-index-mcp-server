export const CONFIG = {
  // Gated tables: optional so development can skip DynamoDB when unset.
  // Call sites apply their own defaults when constructing repositories.
  AMAZON_DYNAMODB_TABLE_NAME: process.env.AMAZON_DYNAMODB_TABLE_NAME,
  AMAZON_SLIDING_WINDOW_TABLE_NAME:
    process.env.AMAZON_SLIDING_WINDOW_TABLE_NAME ||
    'blockbuster-index-amazon-sliding-window-dev',
  AWS_REGION: process.env.AWS_REGION || 'us-west-2',
  BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME:
    process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME,
  BLS_PROCESSED_FILES_TABLE_NAME:
    process.env.BLS_PROCESSED_FILES_TABLE_NAME ||
    'blockbuster-index-bls-processed-files-dev',
  BLS_S3_BUCKET: process.env.BLS_S3_BUCKET || 'blockbuster-index-bls-dev',
  BLS_SIGNALS_TABLE_NAME:
    process.env.BLS_SIGNALS_TABLE_NAME || 'blockbuster-index-bls-signals-dev',
  BLS_STATE_DATA_TABLE_NAME:
    process.env.BLS_STATE_DATA_TABLE_NAME ||
    'blockbuster-index-bls-state-data-dev',
  BROADBAND_DYNAMODB_TABLE_NAME: process.env.BROADBAND_DYNAMODB_TABLE_NAME,
  BROADBAND_S3_BUCKET:
    process.env.BROADBAND_S3_BUCKET || 'blockbuster-index-broadband-dev',
  CACHE_CONTROL: process.env.CACHE_CONTROL || 'max-age=300',
  CENSUS_DYNAMODB_TABLE_NAME: process.env.CENSUS_DYNAMODB_TABLE_NAME,
  CW_LOG_GROUP:
    process.env.CW_LOG_GROUP || '/aws/ecs/blockbuster-index-mcp-log-group',
  CW_LOG_STREAM:
    process.env.CW_LOG_STREAM ||
    `blockbuster-index-mcp-${process.env.AWS_TASK_ID || Date.now()}`,
  FORCE_REFRESH: process.env.FORCE_REFRESH === 'true',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY || '1000', 10),
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  SIGNAL_SCORES_DYNAMODB_TABLE_NAME:
    process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
  VERSION: process.env.npm_package_version || '1.0.0',
  WALMART_DYNAMODB_TABLE_NAME: process.env.WALMART_DYNAMODB_TABLE_NAME,
  WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME:
    process.env.WALMART_SLIDING_WINDOW_DYNAMODB_TABLE_NAME ||
    'blockbuster-index-walmart-sliding-window-dev',
};

export const validateConfig = (): void => {
  const requiredVars = ['S3_BUCKET_NAME'] as const;
  for (const varName of requiredVars) {
    if (!CONFIG[varName]) {
      throw new Error(`${varName} environment variable is required!`);
    }
  }
};
