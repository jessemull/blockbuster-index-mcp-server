import { createPageEvaluateCallback } from './page-evaluate-callback';
import { BrowserDocument } from '../../types/browser';

describe('createPageEvaluateCallback', () => {
  let mockExtractDownloadLinks: jest.Mock;
  let mockDocument: BrowserDocument;

  beforeEach(() => {
    mockExtractDownloadLinks = jest.fn();
    mockDocument = {
      querySelectorAll: jest.fn(),
      querySelector: jest.fn(),
      textContent: 'test content',
      getAttribute: jest.fn(),
      href: 'test-href',
    } as BrowserDocument;

    // Mock globalThis.document
    (globalThis as unknown as { document: BrowserDocument }).document =
      mockDocument;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as unknown as { document?: BrowserDocument }).document;
  });

  it('should create a callback that calls extractDownloadLinks with document', () => {
    const mockResults = [{ state: 'CA', url: 'test-url' }];
    mockExtractDownloadLinks.mockReturnValue(mockResults);

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);
    const result = callback();

    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(mockDocument);
    expect(result).toEqual(mockResults);
  });

  it('should return empty array when extractDownloadLinks returns empty array', () => {
    mockExtractDownloadLinks.mockReturnValue([]);

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);
    const result = callback();

    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(mockDocument);
    expect(result).toEqual([]);
  });

  it('should return multiple download links when extractDownloadLinks returns multiple results', () => {
    const mockResults = [
      { state: 'CA', url: 'test-url-1' },
      { state: 'NY', url: 'test-url-2' },
      { state: 'TX', url: 'test-url-3' },
    ];
    mockExtractDownloadLinks.mockReturnValue(mockResults);

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);
    const result = callback();

    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(mockDocument);
    expect(result).toEqual(mockResults);
  });

  it('should throw error when extractDownloadLinks throws error', () => {
    const error = new Error('Test error');
    mockExtractDownloadLinks.mockImplementation(() => {
      throw error;
    });

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);

    expect(() => callback()).toThrow('Test error');
    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(mockDocument);
  });

  it('should handle null document gracefully', () => {
    delete (globalThis as unknown as { document?: BrowserDocument }).document;
    (globalThis as unknown as { document: BrowserDocument | null }).document =
      null;

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);
    callback();

    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(null);
  });

  it('should handle undefined document gracefully', () => {
    delete (globalThis as unknown as { document?: BrowserDocument }).document;

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);
    callback();

    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(undefined);
  });

  it('should work with different globalThis configurations', () => {
    const customDocument = {
      querySelectorAll: jest.fn(),
      querySelector: jest.fn(),
      textContent: 'custom content',
    } as BrowserDocument;

    (globalThis as unknown as { document: BrowserDocument }).document =
      customDocument;
    mockExtractDownloadLinks.mockReturnValue([
      { state: 'FL', url: 'custom-url' },
    ]);

    const callback = createPageEvaluateCallback(mockExtractDownloadLinks);
    const result = callback();

    expect(mockExtractDownloadLinks).toHaveBeenCalledWith(customDocument);
    expect(result).toEqual([{ state: 'FL', url: 'custom-url' }]);
  });
});
