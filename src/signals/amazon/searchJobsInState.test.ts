/* eslint-disable @typescript-eslint/no-explicit-any */
import { Browser } from 'puppeteer';
import { logger } from '../../util';
import { searchJobsInState } from './searchJobsInState';

declare global {
  var globalThis: {
    document?: {
      querySelector: jest.Mock;
      querySelectorAll: jest.Mock;
    } | null;
  };
}

jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockPage = {
  setUserAgent: jest.fn(),
  goto: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  close: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
} as unknown as Browser;

describe('searchJobsInState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPage.waitForSelector.mockResolvedValue(undefined);
  });

  it('successfully searches jobs in a state', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(150)' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });

    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(150);
  });

  it('handles missing job count elements', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(0);
  });

  it('handles 500+ job scenarios', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(500+)' }),
        }),
        querySelectorAll: jest
          .fn()
          .mockReturnValue([
            { getAttribute: jest.fn().mockReturnValue('1') },
            { getAttribute: jest.fn().mockReturnValue('10') },
          ]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(100);
  });

  it('handles malformed job count text', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest
            .fn()
            .mockReturnValue({ textContent: 'invalid text' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(0);
  });

  it('handles empty textContent', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(0);
  });

  it('handles page.setUserAgent failure', async () => {
    mockPage.setUserAgent.mockRejectedValueOnce(new Error('UserAgent failed'));
    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('UserAgent failed');
  });

  it('handles page.goto failure', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));
    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('Navigation failed');
  });

  it('handles page.evaluate failure', async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error('Evaluate failed'));
    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('Evaluate failed');
  });

  it('handles page.close failure', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(150)' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    mockPage.close.mockRejectedValueOnce(new Error('Close failed'));
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(150);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close page for CA: ',
      expect.any(Error),
    );
  });

  it('handles waitForSelector timeout gracefully', async () => {
    mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(150)' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(150);
  });

  it('handles error thrown in main logic (catch block)', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Main logic error'));
    mockPage.close.mockResolvedValueOnce(undefined);
    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('Main logic error');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to search jobs in CA: ',
      expect.any(Error),
    );
  });

  it('handles error thrown in page.close (finally block)', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(150)' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    mockPage.close.mockRejectedValueOnce(new Error('Close error'));
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(150);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close page for CA: ',
      expect.any(Error),
    );
  });

  it('handles error thrown in both main logic and page.close (double error path)', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Main logic error'));
    mockPage.close.mockRejectedValueOnce(new Error('Close error'));
    await expect(
      searchJobsInState(mockBrowser, 'CA', 'California'),
    ).rejects.toThrow('Main logic error');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to search jobs in CA: ',
      expect.any(Error),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to close page for CA: ',
      expect.any(Error),
    );
  });

  it('handles empty pageButtons array (returns 500)', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(500+)' }),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(500);
  });

  it('handles missing jobCountElement (returns 0)', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue(null),
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(0);
  });

  it('handles button with null data-label attribute (defaults to 1)', async () => {
    mockPage.evaluate.mockImplementation((callback) => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        querySelector: jest.fn().mockReturnValue({
          querySelector: jest.fn().mockReturnValue({ textContent: '(500+)' }),
        }),
        querySelectorAll: jest
          .fn()
          .mockReturnValue([{ getAttribute: jest.fn().mockReturnValue(null) }]),
      };
      try {
        return callback();
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });
    const result = await searchJobsInState(mockBrowser, 'CA', 'California');
    expect(result).toBe(10);
  });
});
