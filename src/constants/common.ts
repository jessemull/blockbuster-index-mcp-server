// Common constants used across the application

export const TIMEOUTS = {
  PAGE_LOAD: 10000, // 10 seconds for page loading
  SELECTOR_WAIT: 10000, // 10 seconds for selector waiting
} as const;

export const PRECISION = {
  SCORE_ROUNDING: 10000, // Used for rounding broadband scores to 4 decimal places
} as const;
