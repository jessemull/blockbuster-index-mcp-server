import { getJobCountFromFilters } from './getJobCountFromFilters';
import { getTotalJobsFromPagination } from './getTotalJobsFromPagination';

describe('getJobCountFromFilters', () => {
  it('returns 0 when no full time button is present', () => {
    const result = getJobCountFromFilters(null, getTotalJobsFromPagination);
    expect(result).toBe(0);
  });

  it('returns 0 when no job count element is present', () => {
    const mockFullTimeButton = {
      querySelector: jest.fn().mockReturnValue(null),
    };
    const result = getJobCountFromFilters(
      mockFullTimeButton,
      getTotalJobsFromPagination,
    );
    expect(result).toBe(0);
  });

  it('extracts job count from normal text like "(67)"', () => {
    const mockJobCountElement = {
      textContent: '(67)',
    };
    const mockFullTimeButton = {
      querySelector: jest.fn().mockReturnValue(mockJobCountElement),
    };
    const result = getJobCountFromFilters(
      mockFullTimeButton,
      getTotalJobsFromPagination,
    );
    expect(result).toBe(67);
  });

  it('handles 500+ scenario by calling pagination function', () => {
    const mockJobCountElement = {
      textContent: '(500+)',
    };
    const mockFullTimeButton = {
      querySelector: jest.fn().mockReturnValue(mockJobCountElement),
    };
    const mockPaginationFn = jest.fn().mockReturnValue(750);
    const result = getJobCountFromFilters(mockFullTimeButton, mockPaginationFn);
    expect(result).toBe(750);
    expect(mockPaginationFn).toHaveBeenCalled();
  });

  it('returns 0 for malformed job count text', () => {
    const mockJobCountElement = {
      textContent: 'invalid text',
    };
    const mockFullTimeButton = {
      querySelector: jest.fn().mockReturnValue(mockJobCountElement),
    };
    const result = getJobCountFromFilters(
      mockFullTimeButton,
      getTotalJobsFromPagination,
    );
    expect(result).toBe(0);
  });
});
