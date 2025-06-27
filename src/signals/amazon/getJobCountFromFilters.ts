export function getJobCountFromFilters(
  fullTimeButton: unknown,
  getTotalJobsFromPaginationFn: (pageButtons: unknown[]) => number,
): number {
  if (
    !fullTimeButton ||
    typeof fullTimeButton !== 'object' ||
    typeof (fullTimeButton as { querySelector: (selector: string) => unknown })
      .querySelector !== 'function'
  ) {
    return 0;
  }

  const jobCountElement = (
    fullTimeButton as { querySelector: (selector: string) => unknown }
  ).querySelector('.job-count');

  if (
    !jobCountElement ||
    typeof jobCountElement !== 'object' ||
    typeof (jobCountElement as { textContent: string }).textContent !== 'string'
  ) {
    return 0;
  }

  const jobCountText =
    (jobCountElement as { textContent: string }).textContent || '';

  const match = jobCountText.match(/\((\d+)(?:\+)?\)/);

  if (match && match[1]) {
    const count = parseInt(match[1], 10);

    if (jobCountText.includes('500+')) {
      return getTotalJobsFromPaginationFn([]);
    }

    return count;
  }

  return 0;
}

export default getJobCountFromFilters;
