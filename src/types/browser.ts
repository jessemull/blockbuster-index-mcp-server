export interface BrowserDocument {
  querySelector: (selector: string) => {
    querySelector: (selector: string) => { textContent: string | null } | null;
  } | null;
  querySelectorAll: (
    selector: string,
  ) => { getAttribute: (name: string) => string | null }[];
}
