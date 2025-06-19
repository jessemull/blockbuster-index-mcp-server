import * as bunyan from "bunyan";
import BunyanCloudWatch from "bunyan-cloudwatch";

const logger = bunyan.createLogger({
  name: "blockbuster-index-mcp-logger",
  level: (process.env.LOG_LEVEL as bunyan.LogLevel) || "info",
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: "info",
      stream: process.stdout,
    },
    {
      level: "error",
      type: "raw",
      stream: BunyanCloudWatch({
        logGroupName: "/aws/lambda/blockbuster-index-mcp-log-group",
        logStreamName: "blockbuster-index-mcp-log-stream",
        awsRegion: "us-west-2",
      }),
    },
  ],
});

export { logger };
