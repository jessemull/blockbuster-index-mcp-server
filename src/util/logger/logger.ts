import * as bunyan from 'bunyan';
import BunyanCloudWatch from 'bunyan-cloudwatch';
import { CONFIG } from '../../config';

export const cloudwatch =
  CONFIG.NODE_ENV === 'production'
    ? [
        {
          level: 'warn' as bunyan.LogLevel,
          type: 'raw',
          stream: BunyanCloudWatch({
            awsRegion: CONFIG.AWS_REGION,
            logGroupName: CONFIG.CW_LOG_GROUP,
            logStreamName: CONFIG.CW_LOG_STREAM,
          }),
        },
      ]
    : [];

export const baseLogger = bunyan.createLogger({
  name: 'blockbuster-index-mcp-logger',
  level: CONFIG.LOG_LEVEL as bunyan.LogLevel,
  serializers: {
    ...bunyan.stdSerializers,
    error: (err: Error) => ({
      message: err.message,
      name: err.name,
      stack: err.stack,
    }),
  },
  streams: [
    {
      level: 'info',
      stream: process.stdout,
    },
    ...cloudwatch,
  ],
});

export const logger = Object.assign(baseLogger, {
  errorWithContext: (
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ) => {
    baseLogger.error({
      error: error.message,
      message,
      stack: error.stack,
      type: 'error',
      ...context,
    });
  },
  endOperation: (
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ) => {
    baseLogger.info({
      duration,
      operation,
      type: 'operation_end',
      ...metadata,
    });
  },
  performance: (
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ) => {
    baseLogger.info({
      duration,
      operation,
      type: 'performance',
      ...metadata,
    });
  },
  signal: (
    signal: string,
    state: string,
    score: number,
    metadata?: Record<string, unknown>,
  ) => {
    baseLogger.info({
      score,
      signal,
      state,
      type: 'signal',
      ...metadata,
    });
  },
  startOperation: (operation: string, metadata?: Record<string, unknown>) => {
    baseLogger.info({
      operation,
      type: 'operation_start',
      ...metadata,
    });
  },
});
