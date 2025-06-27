export function getTotalJobsFromPagination(pageButtons: unknown[]): number {
  if (!Array.isArray(pageButtons) || pageButtons.length === 0) {
    return 500; // Fallback
  }
  let maxPage = 1;
  pageButtons.forEach((button) => {
    if (
      button &&
      typeof button === 'object' &&
      typeof (button as { getAttribute: (name: string) => string | null })
        .getAttribute === 'function'
    ) {
      const pageNumber = parseInt(
        (
          button as { getAttribute: (name: string) => string | null }
        ).getAttribute('data-label') || '1',
        10,
      );
      if (!isNaN(pageNumber) && pageNumber > maxPage) {
        maxPage = pageNumber;
      }
    }
  });
  return maxPage * 10;
}
export default getTotalJobsFromPagination;
