// FCC Technology Code mappings.

export const TECHNOLOGY_CODES = {
  FIBER: [70, 30] as number[],
  CABLE: [60, 20] as number[],
  DSL: [10, 11] as number[],
  WIRELESS: [40, 41, 42] as number[],
  OTHER: [12, 43, 50] as number[],
};

// Broadband speed thresholds (Mbps).

export const SPEED_THRESHOLDS = {
  BROADBAND_MIN: 25, // FCC definition of broadband.
  GIGABIT: 1000, // Gigabit threshold.
} as const;
