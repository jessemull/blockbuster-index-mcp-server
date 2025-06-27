import { getTotalJobsFromPagination } from './getTotalJobsFromPagination';

describe('getTotalJobsFromPagination', () => {
  it('returns 500 when no page buttons are present', () => {
    const result = getTotalJobsFromPagination([]);
    expect(result).toBe(500);
  });

  it('calculates total jobs from page buttons', () => {
    const mockButtons = [
      { getAttribute: jest.fn().mockReturnValue('1') },
      { getAttribute: jest.fn().mockReturnValue('5') },
      { getAttribute: jest.fn().mockReturnValue('10') },
    ];
    const result = getTotalJobsFromPagination(mockButtons);
    expect(result).toBe(100);
  });

  it('handles invalid page numbers gracefully', () => {
    const mockButtons = [
      { getAttribute: jest.fn().mockReturnValue('invalid') },
      { getAttribute: jest.fn().mockReturnValue('3') },
      { getAttribute: jest.fn().mockReturnValue(null) },
    ];
    const result = getTotalJobsFromPagination(mockButtons);
    expect(result).toBe(30);
  });

  it('skips buttons without getAttribute method', () => {
    const mockButtons = [
      { getAttribute: jest.fn().mockReturnValue('1') },
      { someOtherProperty: 'value' },
      { getAttribute: jest.fn().mockReturnValue('5') },
    ];
    const result = getTotalJobsFromPagination(mockButtons);
    expect(result).toBe(50);
  });
});
