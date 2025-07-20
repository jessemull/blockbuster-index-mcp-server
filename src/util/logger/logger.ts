import * as bunyan from 'bunyan';
import { CONFIG } from '../../config';

const mainLogger = bunyan.createLogger({
  name: 'blockbuster-index-mcp-logger',
  level: CONFIG.LOG_LEVEL as bunyan.LogLevel,
});

// Extend logger with success method that always logs...

export const logger = Object.assign(mainLogger, {
  success: (msg: string) => {
    console.log(`SUCCESS: ${msg}`);
  },
});
