import { logger } from '../logger';
import { MAX_RETRIES, RETRY_DELAY } from '../../constants';

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
): Promise<T> => {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.errorWithContext(`Attempt ${attempt} failed:`, lastError);
      if (attempt < maxRetries) {
        const delayMs = RETRY_DELAY * Math.pow(2, attempt - 1);
        logger.performance('retry_delay', delayMs, { attempt, maxRetries });
        await delay(delayMs);
      }
    }
  }
  throw lastError!;
};
