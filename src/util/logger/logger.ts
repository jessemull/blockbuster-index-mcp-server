import * as bunyan from 'bunyan';
import { CONFIG } from '../../config';

export const logger = bunyan.createLogger({
  name: 'blockbuster-index-mcp-logger',
  level: CONFIG.LOG_LEVEL as bunyan.LogLevel,
});
