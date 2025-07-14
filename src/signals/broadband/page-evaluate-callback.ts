import { BrowserDocument } from '../../types/browser';

export function createPageEvaluateCallback(
  extractDownloadLinksFn: (
    document: BrowserDocument,
  ) => { state: string; url: string }[],
) {
  return () => {
    const document = (globalThis as unknown as { document: BrowserDocument })
      .document;

    // Use the extracted function for better testability
    return extractDownloadLinksFn(document);
  };
}
