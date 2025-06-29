import { logger } from '../logger';
import { MAX_RETRIES, RETRY_DELAY } from '../../constants';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Custom replacer to handle Error objects and circular references
function errorReplacer() {
  const seen = new WeakSet<object>();
  return function (key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (value instanceof Error) {
      const errorObj: Record<string, unknown> = {};
      Object.getOwnPropertyNames(value).forEach((prop) => {
        errorObj[prop] = (value as Error & { [key: string]: unknown })[prop];
      });
      return errorObj;
    }
    return value;
  };
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let error: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));

      // Log simplified error for quick readability
      const simplifiedError = {
        message: error.message,
        name: error.name,
      };
      logger.errorWithContext(
        `Attempt ${attempt} failed:`,
        simplifiedError as Error,
      );

      // Log the entire error object as JSON for full debugging, safely handling circular refs
      logger.error(
        `Attempt ${attempt} failed (full error object): ${JSON.stringify(error, errorReplacer(), 2)}`,
      );

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) break;

      const delayMs = RETRY_DELAY * 2 ** (attempt - 1);
      logger.performance('retry_delay', delayMs, { attempt, maxRetries });
      await sleep(delayMs);
    }
  }

  throw error!;
}
