export function createRequestInterceptionHandler() {
  return (request: { url: () => string; continue: () => void }) => {
    const url = request.url();
    if (url && url.includes('.csv')) {
      // Handle CSV download...

      request.continue();
    } else {
      request.continue();
    }
  };
}
