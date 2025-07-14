import { createRequestInterceptionHandler } from './request-interception-handler';

describe('createRequestInterceptionHandler', () => {
  let mockRequest: {
    url: jest.Mock;
    continue: jest.Mock;
  };

  beforeEach(() => {
    mockRequest = {
      url: jest.fn(),
      continue: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a handler that continues CSV requests', () => {
    mockRequest.url.mockReturnValue('https://example.com/data.csv');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should create a handler that continues non-CSV requests', () => {
    mockRequest.url.mockReturnValue('https://example.com/page.html');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle CSV requests with different URL patterns', () => {
    const csvUrls = [
      'https://example.com/data.csv',
      'https://example.com/files/report.csv',
      'https://subdomain.example.com/path/to/file.csv',
      'https://example.com/data.csv?query=param',
      'https://example.com/data.csv#fragment',
    ];

    const handler = createRequestInterceptionHandler();

    csvUrls.forEach((url) => {
      mockRequest.url.mockReturnValue(url);
      handler(mockRequest);
      expect(mockRequest.continue).toHaveBeenCalled();
      jest.clearAllMocks();
    });
  });

  it('should handle non-CSV requests with different URL patterns', () => {
    const nonCsvUrls = [
      'https://example.com/page.html',
      'https://example.com/script.js',
      'https://example.com/style.css',
      'https://example.com/image.png',
      'https://example.com/api/data',
      'https://example.com/data.json',
      'https://example.com/data.xml',
    ];

    const handler = createRequestInterceptionHandler();

    nonCsvUrls.forEach((url) => {
      mockRequest.url.mockReturnValue(url);
      handler(mockRequest);
      expect(mockRequest.continue).toHaveBeenCalled();
      jest.clearAllMocks();
    });
  });

  it('should handle empty URL', () => {
    mockRequest.url.mockReturnValue('');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle null URL', () => {
    mockRequest.url.mockReturnValue(null);

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle undefined URL', () => {
    mockRequest.url.mockReturnValue(undefined);

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle URL with .csv in path but not extension', () => {
    mockRequest.url.mockReturnValue('https://example.com/csv/data.txt');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle URL with .csv in query parameter', () => {
    mockRequest.url.mockReturnValue('https://example.com/data?format=csv');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle case-sensitive CSV detection', () => {
    // The implementation uses .includes('.csv') which is case-sensitive
    mockRequest.url.mockReturnValue('https://example.com/data.CSV');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should handle multiple CSV extensions in URL', () => {
    mockRequest.url.mockReturnValue('https://example.com/old.csv/new.csv');

    const handler = createRequestInterceptionHandler();
    handler(mockRequest);

    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });

  it('should throw error when request.url throws error', () => {
    const error = new Error('URL access failed');
    mockRequest.url.mockImplementation(() => {
      throw error;
    });

    const handler = createRequestInterceptionHandler();

    expect(() => handler(mockRequest)).toThrow('URL access failed');
    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).not.toHaveBeenCalled();
  });

  it('should throw error when request.continue throws error', () => {
    const error = new Error('Continue failed');
    mockRequest.url.mockReturnValue('https://example.com/test.html');
    mockRequest.continue.mockImplementation(() => {
      throw error;
    });

    const handler = createRequestInterceptionHandler();

    expect(() => handler(mockRequest)).toThrow('Continue failed');
    expect(mockRequest.url).toHaveBeenCalled();
    expect(mockRequest.continue).toHaveBeenCalled();
  });
});
