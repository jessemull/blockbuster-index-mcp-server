import * as bunyan from 'bunyan';
import BunyanCloudWatch from 'bunyan-cloudwatch';

const awsRegion = process.env.AWS_REGION || 'us-west-2';
const logGroupName =
  process.env.CW_LOG_GROUP || '/aws/lambda/blockbuster-index-mcp-log-group';
const logStreamName =
  process.env.CW_LOG_STREAM ||
  `blockbuster-index-mcp-${process.env.AWS_TASK_ID || Date.now()}`;

const logger = bunyan.createLogger({
  name: 'blockbuster-index-mcp-logger',
  level: (process.env.LOG_LEVEL as bunyan.LogLevel) || 'info',
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: 'info',
      stream: process.stdout,
    },
    {
      level: 'warn',
      type: 'raw',
      stream: BunyanCloudWatch({
        logGroupName,
        logStreamName,
        awsRegion,
      }),
    },
  ],
});

export { logger };
