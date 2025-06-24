export const CONFIG = {
  AWS_REGION: process.env.AWS_REGION || 'us-west-2',
  CACHE_CONTROL: process.env.CACHE_CONTROL || 'max-age=300',
  CW_LOG_GROUP:
    process.env.CW_LOG_GROUP || '/aws/ecs/blockbuster-index-mcp-log-group',
  CW_LOG_STREAM:
    process.env.CW_LOG_STREAM ||
    `blockbuster-index-mcp-${process.env.AWS_TASK_ID || Date.now()}`,
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  VERSION: process.env.npm_package_version || '1.0.0',
};

export const validateConfig = (): void => {
  const requiredVars = ['S3_BUCKET_NAME'] as const;
  for (const varName of requiredVars) {
    if (!CONFIG[varName]) {
      throw new Error(`${varName} environment variable is required!`);
    }
  }
};
