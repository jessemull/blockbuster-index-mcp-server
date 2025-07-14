import { getFirstLink } from './get-first-link';
import { BrowserDocument } from 'types/browser';

describe('getFirstLink', () => {
  const originalDocument = (
    globalThis as unknown as { document: BrowserDocument }
  ).document;

  afterEach(() => {
    (globalThis as unknown as { document: BrowserDocument }).document =
      originalDocument;
  });

  type MockElement = {
    querySelector: (selector: string) => { textContent?: string | null } | null;
  };

  type MockBrowserDocument = {
    querySelector: (selector: string) => MockElement | null;
  };

  function setMockDocument(mock: MockBrowserDocument): void {
    (globalThis as unknown as { document: BrowserDocument }).document =
      mock as BrowserDocument;
  }

  it('returns parsed version when DOM contains valid version string', () => {
    const mockElement: MockElement = {
      querySelector: () => ({ textContent: 'AK - Fixed - Dec 21v1' }),
    };

    setMockDocument({
      querySelector: () => mockElement,
    });

    expect(getFirstLink()).toBe('Dec 21v1');
  });

  it('returns "unknown" when text does not match expected format', () => {
    const mockElement: MockElement = {
      querySelector: () => ({ textContent: 'Some irrelevant text' }),
    };

    setMockDocument({
      querySelector: () => mockElement,
    });

    expect(getFirstLink()).toBe('unknown');
  });

  it('returns "unknown" when textContent is empty', () => {
    const mockElement: MockElement = {
      querySelector: () => ({ textContent: '' }),
    };

    setMockDocument({
      querySelector: () => mockElement,
    });

    expect(getFirstLink()).toBe('unknown');
  });

  it('returns "unknown" when querySelector returns null for inner element', () => {
    const mockElement: MockElement = {
      querySelector: () => null,
    };

    setMockDocument({
      querySelector: () => mockElement,
    });

    expect(getFirstLink()).toBe('unknown');
  });

  it('returns "unknown" when outer querySelector returns null', () => {
    setMockDocument({
      querySelector: () => null,
    });

    expect(getFirstLink()).toBe('unknown');
  });
});
