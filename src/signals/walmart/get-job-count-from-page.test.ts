import { getJobCountFromPage } from './get-job-count-from-page';
import { Page } from 'puppeteer';

jest.mock('puppeteer');

const mockEvaluate = jest.fn();
const mockPage = {
  evaluate: mockEvaluate,
} as unknown as Page;

describe('getJobCountFromPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should extract job count from page', async () => {
    mockEvaluate.mockResolvedValueOnce(150);

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe(150);
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.any(Function),
      '#count_totalResults',
    );
  });

  it('should return 0 when job count element is not found', async () => {
    mockEvaluate.mockResolvedValueOnce(0);

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe(0);
  });

  it('should return 0 when job count text is invalid', async () => {
    mockEvaluate.mockResolvedValueOnce(0);

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe(0);
  });

  it('should handle evaluation errors', async () => {
    const error = new Error('DOM evaluation error');
    mockEvaluate.mockRejectedValueOnce(error);

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;
    expect(result).toBe(0);
  });

  it('should handle page evaluation function', async () => {
    mockEvaluate.mockImplementationOnce((fn, selector) => {
      const mockJobCountElement = {
        textContent: '150',
      };

      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(mockJobCountElement),
      };

      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = mockDocument;

      try {
        return fn(selector);
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe(150);
  });

  it('should handle missing span element', async () => {
    mockEvaluate.mockImplementationOnce((fn, selector) => {
      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(null),
      };

      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = mockDocument;

      try {
        return fn(selector);
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe(0);
  });

  it('should handle non-numeric text content', async () => {
    mockEvaluate.mockImplementationOnce((fn, selector) => {
      const mockJobCountElement = {
        textContent: 'No jobs found',
      };

      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(mockJobCountElement),
      };

      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = mockDocument;

      try {
        return fn(selector);
      } finally {
        (globalThis as any).document = originalDocument;
      }
    });

    const resultPromise = getJobCountFromPage(mockPage);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe(0);
  });
});
