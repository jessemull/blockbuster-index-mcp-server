import * as bunyan from 'bunyan';
import { CONFIG } from '../../config';

// Create a logger factory that can create loggers for different signals
class LoggerFactory {
  private static loggers = new Map<string, bunyan>();

  static getLogger(signal?: string): bunyan {
    const loggerName = signal
      ? `blockbuster-index-${signal}`
      : 'blockbuster-index-main';

    if (!this.loggers.has(loggerName)) {
      this.loggers.set(
        loggerName,
        bunyan.createLogger({
          name: loggerName,
          level: CONFIG.LOG_LEVEL as bunyan.LogLevel,
        }),
      );
    }

    return this.loggers.get(loggerName)!;
  }

  static getMainLogger(): bunyan {
    return this.getLogger();
  }

  static getAmazonLogger(): bunyan {
    return this.getLogger('amazon');
  }

  static getBroadbandLogger(): bunyan {
    return this.getLogger('broadband');
  }

  static getCensusLogger(): bunyan {
    return this.getLogger('census');
  }
}

// Export the main logger for backward compatibility
export const logger = LoggerFactory.getMainLogger();

// Export the factory for creating signal-specific loggers
export { LoggerFactory };
