console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log(
  'CENSUS_DYNAMODB_TABLE_NAME:',
  process.env.CENSUS_DYNAMODB_TABLE_NAME,
);
console.log(
  'AMAZON_DYNAMODB_TABLE_NAME:',
  process.env.AMAZON_DYNAMODB_TABLE_NAME,
);
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);
console.log('MAX_RETRIES:', process.env.MAX_RETRIES);
console.log('RETRY_DELAY:', process.env.RETRY_DELAY);
console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
console.log('CW_LOG_GROUP:', process.env.CW_LOG_GROUP);
console.log('CW_LOG_STREAM:', process.env.CW_LOG_STREAM);
console.log('npm_package_version:', process.env.npm_package_version);
