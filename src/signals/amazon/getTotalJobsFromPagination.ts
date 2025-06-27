export function getTotalJobsFromPagination(pageButtons: unknown[]): number {
  if (!Array.isArray(pageButtons) || pageButtons.length === 0) {
    return 500; // Fallback value
  }

  let maxPage = 1;

  pageButtons.forEach((button) => {
    const hasGetAttribute =
      button &&
      typeof button === 'object' &&
      typeof (button as { getAttribute: (name: string) => string | null })
        .getAttribute === 'function';

    if (!hasGetAttribute) return;

    const pageNumber = parseInt(
      (
        button as { getAttribute: (name: string) => string | null }
      ).getAttribute('data-label') || '1',
      10,
    );

    if (!isNaN(pageNumber) && pageNumber > maxPage) {
      maxPage = pageNumber;
    }
  });

  return maxPage * 10;
}

export default getTotalJobsFromPagination;
