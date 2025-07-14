import { getCurrentFccDataVersion } from './get-current-fcc-data-version';

const mockGoto = jest.fn();
const mockEvaluate = jest.fn();
const mockClose = jest.fn();
const mockNewPage = jest.fn().mockResolvedValue({
  goto: mockGoto,
  evaluate: mockEvaluate,
  close: mockClose,
});
const mockBrowser = { newPage: mockNewPage, close: mockClose };
const mockLaunch = jest.fn().mockResolvedValue(mockBrowser);

// Mock puppeteer
jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: () => mockLaunch(),
  },
}));

type MockElement = {
  querySelector: (selector: string) => MockElement | null;
  textContent?: string;
};

type MockDocument = {
  querySelector: (selector: string) => MockElement | null;
};

describe('getCurrentFccDataVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoto.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue(mockBrowser);
  });

  it('successfully extracts FCC data version from properly formatted text', async () => {
    mockEvaluate.mockImplementation(() => {
      const mockElement: MockElement = {
        querySelector: () => ({
          querySelector: () => null,
          textContent: 'AK - Fixed - Dec 21v1',
        }),
      };
      const mockDocument: MockDocument = {
        querySelector: () => mockElement,
      };
      const firstLink = mockDocument.querySelector('div.field-item.even a');
      if (firstLink) {
        const text = firstLink.querySelector('*')?.textContent?.trim();
        const versionMatch = text?.match(/- ([\w\s\d]+)$/);
        return versionMatch ? versionMatch[1].trim() : 'unknown';
      }
      return 'unknown';
    });

    const version = await getCurrentFccDataVersion();
    expect(version).toBe('Dec 21v1');
    expect(mockClose).toHaveBeenCalled();
  });

  it('returns unknown when no DOM element is found', async () => {
    mockEvaluate.mockImplementation(() => {
      const mockDocument: MockDocument = {
        querySelector: () => null,
      };
      const firstLink = mockDocument.querySelector('div.field-item.even a');
      if (firstLink) {
        const text = firstLink.querySelector('*')?.textContent?.trim();
        const versionMatch = text?.match(/- ([\w\s\d]+)$/);
        return versionMatch ? versionMatch[1].trim() : 'unknown';
      }
      return 'unknown';
    });

    const version = await getCurrentFccDataVersion();
    expect(version).toBe('unknown');
    expect(mockClose).toHaveBeenCalled();
  });

  it('returns unknown when version text is malformed', async () => {
    mockEvaluate.mockImplementation(() => {
      const mockElement: MockElement = {
        querySelector: () => ({
          querySelector: () => null,
          textContent: 'Invalid format text without version',
        }),
      };
      const mockDocument: MockDocument = {
        querySelector: () => mockElement,
      };
      const firstLink = mockDocument.querySelector('div.field-item.even a');
      if (firstLink) {
        const text = firstLink.querySelector('*')?.textContent?.trim();
        const versionMatch = text?.match(/- ([\w\s\d]+)$/);
        return versionMatch ? versionMatch[1].trim() : 'unknown';
      }
      return 'unknown';
    });

    const version = await getCurrentFccDataVersion();
    expect(version).toBe('unknown');
    expect(mockClose).toHaveBeenCalled();
  });

  it('handles empty text content', async () => {
    mockEvaluate.mockImplementation(() => {
      const mockElement: MockElement = {
        querySelector: () => ({
          querySelector: () => null,
          textContent: '',
        }),
      };
      const mockDocument: MockDocument = {
        querySelector: () => mockElement,
      };
      const firstLink = mockDocument.querySelector('div.field-item.even a');
      if (firstLink) {
        const text = firstLink.querySelector('*')?.textContent?.trim();
        const versionMatch = text?.match(/- ([\w\s\d]+)$/);
        return versionMatch ? versionMatch[1].trim() : 'unknown';
      }
      return 'unknown';
    });

    const version = await getCurrentFccDataVersion();
    expect(version).toBe('unknown');
    expect(mockClose).toHaveBeenCalled();
  });

  it('closes browser on page.goto error', async () => {
    mockGoto.mockRejectedValueOnce(new Error('Navigation failed'));
    await expect(getCurrentFccDataVersion()).rejects.toThrow(
      'Navigation failed',
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it('closes browser on page.evaluate error', async () => {
    mockEvaluate.mockRejectedValueOnce(new Error('Evaluation failed'));
    await expect(getCurrentFccDataVersion()).rejects.toThrow(
      'Evaluation failed',
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it('closes browser on newPage error', async () => {
    mockNewPage.mockRejectedValueOnce(new Error('newPage failed'));
    await expect(getCurrentFccDataVersion()).rejects.toThrow('newPage failed');
    expect(mockClose).toHaveBeenCalled();
  });

  it('closes browser on browser launch error', async () => {
    mockLaunch.mockRejectedValueOnce(new Error('launch failed'));
    await expect(getCurrentFccDataVersion()).rejects.toThrow('launch failed');
    expect(mockClose).not.toHaveBeenCalled(); // browser never launched
  });
});
