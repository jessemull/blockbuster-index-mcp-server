export interface BrowserDocument {
  querySelector: (selector: string) => {
    querySelector: (selector: string) => { textContent: null | string } | null;
  } | null;
  querySelectorAll: (
    selector: string,
  ) => { getAttribute: (name: string) => null | string }[];
}
