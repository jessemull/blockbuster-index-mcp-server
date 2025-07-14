import type { BrowserDocument } from '../../types/browser';

export interface DownloadLink {
  state: string;
  url: string;
}

// Extracts download links for broadband data from FCC page elements...

export function extractDownloadLinks(
  document: BrowserDocument,
): DownloadLink[] {
  // Find all anchor tags with Box.com download links...

  const anchorElements = document.querySelectorAll(
    'a[href*="us-fcc.box.com/v/"]',
  );

  const links: DownloadLink[] = [];
  for (const element of anchorElements) {
    const href = element.getAttribute('href');
    if (href) {
      // Extract state from href or assume text content through DOM...

      const text =
        (element as unknown as { textContent?: string }).textContent?.trim() ||
        '';
      const stateMatch = text.match(/^([A-Z]{2})\s/);
      if (stateMatch) {
        links.push({
          state: stateMatch[1],
          url: href,
        });
      }
    }
  }

  return links;
}
