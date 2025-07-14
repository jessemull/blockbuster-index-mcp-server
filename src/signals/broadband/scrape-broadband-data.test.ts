import { scrapeBroadbandData } from './scrape-broadband-data';

jest.mock('../../util/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const originalSetTimeout = setTimeout;
const mockSetTimeout = jest.fn((callback) => {
  callback();
  return 1;
});

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
};

const mockPage = {
  goto: jest.fn(),
  evaluate: jest.fn(),
  waitForSelector: jest.fn(),
  setRequestInterception: jest.fn(),
  on: jest.fn(),
  click: jest.fn(),
};

const mockPuppeteer = {
  launch: jest.fn().mockResolvedValue(mockBrowser),
};

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
};

const mockPath = {
  resolve: jest.fn(),
  join: jest.fn(),
};

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: mockPuppeteer,
}));

jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);

describe('scrapeBroadbandData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    global.setTimeout = mockSetTimeout as unknown as typeof setTimeout;

    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockPage.setRequestInterception.mockResolvedValue(undefined);
    mockPage.click.mockResolvedValue(undefined);
    mockPage.on.mockImplementation(() => undefined);
    mockPath.resolve.mockReturnValue('/mocked/data/broadband');
    mockPath.join.mockReturnValue(
      '/mocked/data/broadband/CA-broadband-data.csv',
    );
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it('should scrape broadband data successfully', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    await scrapeBroadbandData();

    expect(mockPuppeteer.launch).toHaveBeenCalledWith({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPage.goto).toHaveBeenCalledTimes(3); // Initial + 2 downloads
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2);
    expect(mockPage.click).toHaveBeenCalledTimes(2);
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle no download links found', async () => {
    mockPage.evaluate.mockResolvedValue([]);
    mockFs.existsSync.mockReturnValue(false);

    await scrapeBroadbandData();

    expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPage.goto).toHaveBeenCalledTimes(1); // Only initial page
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/mocked/data/broadband', {
      recursive: true,
    });
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle download failures gracefully', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    // Mock first download to fail, second to succeed
    mockPage.waitForSelector
      .mockRejectedValueOnce(new Error('Download button not found'))
      .mockResolvedValueOnce(undefined);

    await scrapeBroadbandData();

    expect(mockPage.goto).toHaveBeenCalledTimes(3); // Initial + 2 download attempts
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2);
    expect(mockPage.click).toHaveBeenCalledTimes(1); // Only successful one
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle puppeteer launch failure', async () => {
    mockPuppeteer.launch.mockRejectedValueOnce(
      new Error('Puppeteer launch failed'),
    );

    await expect(scrapeBroadbandData()).rejects.toThrow(
      'Puppeteer launch failed',
    );
  });

  it('should handle page navigation failure', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

    await expect(scrapeBroadbandData()).rejects.toThrow('Navigation failed');
  });

  it('should handle evaluate failure', async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error('Evaluate failed'));

    await expect(scrapeBroadbandData()).rejects.toThrow('Evaluate failed');
  });

  it('should handle existing data directory', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(true);

    await scrapeBroadbandData();

    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(mockPage.goto).toHaveBeenCalledTimes(2); // Initial + 1 download
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(1);
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle invalid download URLs', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: null },
      { state: 'NY', url: 'https://us-fcc.box.com/v/NY-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    // Mock goto to reject on null URL
    mockPage.goto
      .mockResolvedValueOnce(undefined) // Initial page
      .mockResolvedValueOnce(undefined) // CA download
      .mockRejectedValueOnce(new Error('Invalid URL')) // TX null URL
      .mockResolvedValueOnce(undefined); // NY download

    await scrapeBroadbandData();

    expect(mockPage.goto).toHaveBeenCalledTimes(4); // Initial + 3 download attempts
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2); // Only valid URLs
    expect(mockPage.click).toHaveBeenCalledTimes(2);
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle mixed success and failure downloads', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
      { state: 'NY', url: 'https://us-fcc.box.com/v/NY-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    mockPage.waitForSelector
      .mockResolvedValueOnce(undefined) // CA success
      .mockRejectedValueOnce(new Error('Download failed')) // TX failure
      .mockResolvedValueOnce(undefined); // NY success

    await scrapeBroadbandData();

    expect(mockPage.goto).toHaveBeenCalledTimes(4); // Initial + 3 downloads
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(3);
    expect(mockPage.click).toHaveBeenCalledTimes(2); // Only successful ones
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should use custom executable path if provided', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chrome/path';

    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    await scrapeBroadbandData();

    expect(mockPuppeteer.launch).toHaveBeenCalledWith({
      executablePath: '/custom/chrome/path',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle null URLs in download links', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: null },
      { state: 'NY', url: 'https://us-fcc.box.com/v/NY-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    // Mock goto to handle null URL properly
    mockPage.goto
      .mockResolvedValueOnce(undefined) // Initial page
      .mockResolvedValueOnce(undefined) // CA download
      .mockRejectedValueOnce(new Error('Cannot navigate to null')) // TX null URL
      .mockResolvedValueOnce(undefined); // NY download

    await scrapeBroadbandData();

    expect(mockPage.goto).toHaveBeenCalledTimes(4); // Initial + 3 attempts
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2); // Only valid URLs proceed
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should set up request interception for each download', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
      { state: 'TX', url: 'https://us-fcc.box.com/v/TX-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    await scrapeBroadbandData();

    // Request interception should be set up for each download
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(false);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle request interception setup', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    await scrapeBroadbandData();

    // Request interception should be set up for each download
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(false);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle browser close failure', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    // Mock close to fail - the function should throw since close is not wrapped in try-catch
    mockBrowser.close.mockRejectedValueOnce(new Error('Close failed'));

    // The function should throw because close error is not caught in finally block
    await expect(scrapeBroadbandData()).rejects.toThrow('Close failed');

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout on download button', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);
    mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));

    await scrapeBroadbandData();

    expect(mockPage.waitForSelector).toHaveBeenCalledWith(
      'button[data-testid="download-btn"]',
      { timeout: 10000 },
    );
    expect(mockPage.click).not.toHaveBeenCalled(); // Should not click if selector fails
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should call page.evaluate with extractDownloadLinks function', async () => {
    const mockDownloadLinks = [
      { state: 'CA', url: 'https://us-fcc.box.com/v/CA-download' },
    ];

    mockPage.evaluate.mockResolvedValue(mockDownloadLinks);
    mockFs.existsSync.mockReturnValue(false);

    await scrapeBroadbandData();

    // Verify that page.evaluate was called with a callback function
    expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });
});
