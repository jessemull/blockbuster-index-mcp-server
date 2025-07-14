import { BrowserDocument } from 'types/browser';

export const getFirstLink = () => {
  const firstLink = (
    globalThis as unknown as { document: BrowserDocument }
  ).document.querySelector('div.field-item.even a');
  if (firstLink) {
    const text = firstLink.querySelector('*')?.textContent?.trim();
    const versionMatch = text?.match(/- ([\w\s\d]+)$/);
    return versionMatch ? versionMatch[1].trim() : 'unknown';
  }
  return 'unknown';
};
