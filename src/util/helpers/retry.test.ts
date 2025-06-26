import { logger } from '../logger';
import { retryWithBackoff } from './retry';

jest.mock('../logger', () => ({
  logger: {
    errorWithContext: jest.fn(),
    performance: jest.fn(),
  },
}));

jest.mock('../../constants', () => ({
  MAX_RETRIES: 3,
  RETRY_DELAY: 100,
}));

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('succeeds on first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.errorWithContext).not.toHaveBeenCalled();
  });

  it('succeeds after 2 failures', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('eventual success');

    const promise = retryWithBackoff(fn);

    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);

    const result = await promise;

    expect(result).toBe('eventual success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(logger.errorWithContext).toHaveBeenCalledTimes(2);
    expect(logger.performance).toHaveBeenCalledWith('retry_delay', 100, {
      attempt: 1,
      maxRetries: 3,
    });
    expect(logger.performance).toHaveBeenCalledWith('retry_delay', 200, {
      attempt: 2,
      maxRetries: 3,
    });
  });

  it('throws after max retries', async () => {
    jest.useRealTimers();
    const error = new Error('final failure');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn)).rejects.toThrow('final failure');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(logger.errorWithContext).toHaveBeenCalledTimes(3);
    expect(logger.performance).toHaveBeenCalledTimes(2);
  }, 10000);

  it('respects custom maxRetries', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockResolvedValue('done');

    const promise = retryWithBackoff(fn, 2);
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(logger.performance).toHaveBeenCalledWith('retry_delay', 100, {
      attempt: 1,
      maxRetries: 2,
    });
  });

  it('wraps non-Error throws', async () => {
    const fn = jest.fn().mockRejectedValue('oops');

    const promise = retryWithBackoff(fn, 1);
    await expect(promise).rejects.toThrow('oops');
    expect(logger.errorWithContext).toHaveBeenCalledWith(
      'Attempt 1 failed:',
      expect.any(Error),
    );
  });
});
