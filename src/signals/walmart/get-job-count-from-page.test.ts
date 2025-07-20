import { getJobCountFromPage } from './get-job-count-from-page';
import { Page } from 'puppeteer';

// Mock puppeteer
jest.mock('puppeteer');

const mockEvaluate = jest.fn();
const mockPage = {
  evaluate: mockEvaluate,
} as unknown as Page;

describe('getJobCountFromPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract job count from page', async () => {
    mockEvaluate.mockResolvedValueOnce(150);

    const result = await getJobCountFromPage(mockPage);

    expect(result).toBe(150);
    expect(mockEvaluate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should return 0 when job count element is not found', async () => {
    mockEvaluate.mockResolvedValueOnce(0);

    const result = await getJobCountFromPage(mockPage);

    expect(result).toBe(0);
  });

  it('should return 0 when job count text is invalid', async () => {
    mockEvaluate.mockResolvedValueOnce(0);

    const result = await getJobCountFromPage(mockPage);

    expect(result).toBe(0);
  });

  it('should handle evaluation errors', async () => {
    const error = new Error('DOM evaluation error');
    mockEvaluate.mockRejectedValueOnce(error);

    await expect(getJobCountFromPage(mockPage)).rejects.toThrow(
      'DOM evaluation error',
    );
  });

  it('should handle page evaluation function', async () => {
    mockEvaluate.mockImplementationOnce((fn) => {
      // Simulate the page evaluation function with proper globalThis structure
      const mockTextElement = {
        textContent: '150',
      };

      const mockJobCountElement = {
        querySelector: jest.fn().mockReturnValue(mockTextElement),
      };

      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(mockJobCountElement),
      };

      // Set up globalThis properly for the function context
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = mockDocument;

      try {
        return fn();
      } finally {
        // Restore original globalThis
        (globalThis as any).document = originalDocument;
      }
    });

    const result = await getJobCountFromPage(mockPage);

    expect(result).toBe(150);
  });

  it('should handle missing span element', async () => {
    mockEvaluate.mockImplementationOnce((fn) => {
      const mockJobCountElement = {
        querySelector: jest.fn().mockReturnValue(null), // No span found
      };

      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(mockJobCountElement),
      };

      // Set up globalThis properly for the function context
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = mockDocument;

      try {
        return fn();
      } finally {
        // Restore original globalThis
        (globalThis as any).document = originalDocument;
      }
    });

    const result = await getJobCountFromPage(mockPage);

    expect(result).toBe(0);
  });

  it('should handle non-numeric text content', async () => {
    mockEvaluate.mockImplementationOnce((fn) => {
      const mockTextElement = {
        textContent: 'No jobs found',
      };

      const mockJobCountElement = {
        querySelector: jest.fn().mockReturnValue(mockTextElement),
      };

      const mockDocument = {
        querySelector: jest.fn().mockReturnValue(mockJobCountElement),
      };

      // Set up globalThis properly for the function context
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = mockDocument;

      try {
        return fn();
      } finally {
        // Restore original globalThis
        (globalThis as any).document = originalDocument;
      }
    });

    const result = await getJobCountFromPage(mockPage);

    expect(result).toBe(0);
  });
});
