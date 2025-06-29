import { logger } from '../logger';
import { MAX_RETRIES, RETRY_DELAY } from '../../constants';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

      // Sanitize the error to prevent large objects from being logged
      const sanitizedError = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };

      logger.errorWithContext(
        `Attempt ${attempt} failed:`,
        sanitizedError as Error,
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
