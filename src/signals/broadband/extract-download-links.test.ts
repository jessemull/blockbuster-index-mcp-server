import { extractDownloadLinks } from './extract-download-links';
import type { BrowserDocument } from '../../types/browser';

describe('extractDownloadLinks', () => {
  const createMockElement = (
    href: string | null,
    textContent: string | null,
  ) => ({
    getAttribute: jest.fn().mockImplementation((attr: string) => {
      if (attr === 'href') return href;
      return null;
    }),
    textContent,
  });

  const createMockDocument = (
    elements: ReturnType<typeof createMockElement>[],
  ): BrowserDocument => ({
    querySelectorAll: jest.fn().mockReturnValue(elements),
    querySelector: jest.fn(),
  });

  it('should extract valid download links with state codes', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/CA-download',
        'CA Broadband Data',
      ),
      createMockElement('https://us-fcc.box.com/v/TX-download', 'TX Download'),
      createMockElement('https://us-fcc.box.com/v/NY-download', 'NY Data File'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
      { state: 'NY', url: 'https://us-fcc.box.com/v/NY-download' },
    ]);

    expect(mockDocument.querySelectorAll).toHaveBeenCalledWith(
      'a[href*="us-fcc.box.com/v/"]',
    );
  });

  it('should handle elements with no href attribute', () => {
    const mockElements = [
      createMockElement(null, 'CA Broadband Data'),
      createMockElement('https://us-fcc.box.com/v/TX-download', 'TX Download'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ]);
  });

  it('should handle elements with no textContent', () => {
    const mockElements = [
      createMockElement('https://us-fcc.box.com/v/CA-download', null),
      createMockElement('https://us-fcc.box.com/v/TX-download', 'TX Download'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ]);
  });

  it('should handle elements with empty textContent', () => {
    const mockElements = [
      createMockElement('https://us-fcc.box.com/v/CA-download', ''),
      createMockElement('https://us-fcc.box.com/v/TX-download', 'TX Download'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ]);
  });

  it('should handle textContent with whitespace', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/CA-download',
        '  CA  Broadband Data  ',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/TX-download',
        '\t\nTX\t\nDownload\t\n',
      ),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ]);
  });

  it('should ignore elements without valid state pattern', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/invalid-download',
        'Invalid Text',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/another-download',
        'No State Code',
      ),
      createMockElement('https://us-fcc.box.com/v/CA-download', 'CA Valid'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ]);
  });

  it('should handle state codes in different text formats', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/CA-download',
        'CA - California Data',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/TX-download',
        'TX: Texas Broadband',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/NY-download',
        'NY (New York)',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/FL-download',
        'FL Download Link',
      ),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    // Note: TX: doesn't match because regex expects space after state code, not colon
    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'NY', url: 'https://us-fcc.box.com/v/NY-download' },
      { state: 'FL', url: 'https://us-fcc.box.com/v/FL-download' },
    ]);
  });

  it('should handle lowercase state codes', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/ca-download',
        'ca broadband data',
      ),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    // Should not match lowercase since regex expects uppercase
    expect(result).toEqual([]);
  });

  it('should handle state codes not at the beginning of text', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/CA-download',
        'Download CA Data',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/TX-download',
        'State: TX Broadband',
      ),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    // Should not match since regex expects state code at the beginning
    expect(result).toEqual([]);
  });

  it('should handle empty anchor elements array', () => {
    const mockDocument = createMockDocument([]);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([]);
    expect(mockDocument.querySelectorAll).toHaveBeenCalledWith(
      'a[href*="us-fcc.box.com/v/"]',
    );
  });

  it('should handle elements with invalid href URLs', () => {
    const mockElements = [
      createMockElement('invalid-url', 'CA Download'),
      createMockElement('https://other-site.com/download', 'TX Download'),
      createMockElement('https://us-fcc.box.com/v/CA-download', 'CA Valid'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    // Function processes all elements with href and state pattern, regardless of URL validity
    expect(result).toEqual([
      { state: 'CA', url: 'invalid-url' },
      { state: 'TX', url: 'https://other-site.com/download' },
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ]);
  });

  it('should handle mixed valid and invalid elements', () => {
    const mockElements = [
      createMockElement('https://us-fcc.box.com/v/CA-download', 'CA Broadband'),
      createMockElement(null, 'TX Download'), // No href
      createMockElement('https://us-fcc.box.com/v/NY-download', null), // No textContent
      createMockElement(
        'https://us-fcc.box.com/v/FL-download',
        'Invalid Pattern',
      ),
      createMockElement('https://us-fcc.box.com/v/WA-download', 'WA Data'),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'WA', url: 'https://us-fcc.box.com/v/WA-download' },
    ]);
  });

  it('should handle elements with multiple state codes in text', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/CA-download',
        'CA and TX Data',
      ),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    // Should only match the first state code at the beginning
    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ]);
  });

  it('should handle complex textContent with special characters', () => {
    const mockElements = [
      createMockElement(
        'https://us-fcc.box.com/v/CA-download',
        'CA - Broadband Data (2024)',
      ),
      createMockElement(
        'https://us-fcc.box.com/v/TX-download',
        'TX | Texas Broadband Info',
      ),
    ];

    const mockDocument = createMockDocument(mockElements);
    const result = extractDownloadLinks(mockDocument);

    expect(result).toEqual([
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ]);
  });
});
