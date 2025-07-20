import * as bunyan from 'bunyan';
import { CONFIG } from '../../config';

const mainLogger = bunyan.createLogger({
  name: 'blockbuster-index-mcp-logger',
  level: CONFIG.LOG_LEVEL as bunyan.LogLevel,
});

export const logger = mainLogger;
