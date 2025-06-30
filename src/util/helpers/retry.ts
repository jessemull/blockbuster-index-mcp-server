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

      logger.error(`Attempt ${attempt} failed:`, {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) break;

      const delayMs = RETRY_DELAY * 2 ** (attempt - 1);
      logger.info('Retry delay', { delayMs, attempt, maxRetries });
      await sleep(delayMs);
    }
  }

  throw error!;
}
