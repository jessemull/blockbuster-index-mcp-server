// FCC Technology Code mappings.

export const TECHNOLOGY_CODES = {
  FIBER: [70, 30] as number[],
  CABLE: [60, 20] as number[],
  DSL: [10, 11] as number[],
  WIRELESS: [40, 41, 42] as number[],
  OTHER: [12, 43, 50] as number[],
} as const;

export const TECHNOLOGY_NAME_TO_CODE = {
  Fiber: '70',
  Cable: '60',
  DSL: '10',
  Wireless: '40',
  Other: '12',
} as const;

// Broadband speed thresholds (Mbps).

export const SPEED_THRESHOLDS = {
  BROADBAND_MIN: 25, // FCC definition of broadband.
  GIGABIT: 1000, // Gigabit threshold.
} as const;

// DynamoDB table and index names for broadband data.

export const BROADBAND_DYNAMODB = {
  TABLE_NAME: 'broadband-signals',
  STATE_VERSION_INDEX: 'state-dataVersion-index', // GSI for querying by state and dataVersion.
} as const;

// Precision for score calculations.

export const PRECISION = {
  SCORE_ROUNDING: 10000, // Used for rounding broadband scores to 4 decimal places
} as const;
