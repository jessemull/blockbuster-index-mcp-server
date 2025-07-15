// Census API URLs and endpoints

export const CENSUS_API_BASE_URL = 'https://api.census.gov/data';

export const CENSUS_ENDPOINTS = {
  ESTABLISHMENT_DATA: (year: number) =>
    `${CENSUS_API_BASE_URL}/${year}/cbp?get=ESTAB,NAICS2017_LABEL&for=state:*&NAICS2017=44-45`,
  POPULATION_DATA: (year: number) =>
    `${CENSUS_API_BASE_URL}/${year}/acs/acs1?get=NAME,B01003_001E&for=state:*`,
} as const;

// Census calculation constants
export const CENSUS_CALCULATION = {
  PER_100K_MULTIPLIER: 100000, // Used to calculate establishments per 100k people
} as const;
