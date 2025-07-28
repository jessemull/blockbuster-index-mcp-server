// BLS Industry Classification Codes (NAICS)

export const BLS_INDUSTRY_CODES = {
  RETAIL_TRADE: ['44-45', '44', '45'],
  TOTAL_PRIVATE: ['10'],
} as const;

// State FIPS Codes for BLS data
// These are used to identify state-level data in BLS CSV files

export const STATE_FIPS_CODES: Record<string, string> = {
  '01000': 'AL', // Alabama
  '02000': 'AK', // Alaska
  '04000': 'AZ', // Arizona
  '05000': 'AR', // Arkansas
  '06000': 'CA', // California
  '08000': 'CO', // Colorado
  '09000': 'CT', // Connecticut
  '10000': 'DE', // Delaware
  '11000': 'DC', // District of Columbia
  '12000': 'FL', // Florida
  '13000': 'GA', // Georgia
  '15000': 'HI', // Hawaii
  '16000': 'ID', // Idaho
  '17000': 'IL', // Illinois
  '18000': 'IN', // Indiana
  '19000': 'IA', // Iowa
  '20000': 'KS', // Kansas
  '21000': 'KY', // Kentucky
  '22000': 'LA', // Louisiana
  '23000': 'ME', // Maine
  '24000': 'MD', // Maryland
  '25000': 'MA', // Massachusetts
  '26000': 'MI', // Michigan
  '27000': 'MN', // Minnesota
  '28000': 'MS', // Mississippi
  '29000': 'MO', // Missouri
  '30000': 'MT', // Montana
  '31000': 'NE', // Nebraska
  '32000': 'NV', // Nevada
  '33000': 'NH', // New Hampshire
  '34000': 'NJ', // New Jersey
  '35000': 'NM', // New Mexico
  '36000': 'NY', // New York
  '37000': 'NC', // North Carolina
  '38000': 'ND', // North Dakota
  '39000': 'OH', // Ohio
  '40000': 'OK', // Oklahoma
  '41000': 'OR', // Oregon
  '42000': 'PA', // Pennsylvania
  '44000': 'RI', // Rhode Island
  '45000': 'SC', // South Carolina
  '46000': 'SD', // South Dakota
  '47000': 'TN', // Tennessee
  '48000': 'TX', // Texas
  '49000': 'UT', // Utah
  '50000': 'VT', // Vermont
  '51000': 'VA', // Virginia
  '53000': 'WA', // Washington
  '54000': 'WV', // West Virginia
  '55000': 'WI', // Wisconsin
  '56000': 'WY', // Wyoming
} as const;

// Trend analysis thresholds

export const TREND_THRESHOLDS = {
  SLOPE_THRESHOLD: 0.001, // Small threshold to account for noise
} as const;

// Score calculation parameters

export const SCORE_PARAMETERS = {
  DECLINING_MULTIPLIER: 1.0, // Higher score for declining retail
  STABLE_MULTIPLIER: 0.5, // Medium score for stable retail
  GROWING_MULTIPLIER: 0.0, // Lower score for growing retail
  MAX_SCORE: 100, // Maximum possible score
} as const;

// Data validation parameters

export const VALIDATION = {
  MIN_DATA_POINTS: 2, // Minimum data points for trend calculation
  MIN_YEAR: 1990, // Earliest year to consider
  MAX_YEAR: 2024, // Latest year to consider
} as const;
