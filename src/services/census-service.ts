import axios from 'axios';
import { States } from '../types';
import {
  CensusData,
  CensusEstablishmentData,
  CensusPopulationData,
} from '../types';
import { logger } from '../util';

const STATE_CODE_TO_ABBR: Record<string, string> = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
};

export const fetchCensusEstablishmentData = async (
  year: number,
): Promise<CensusEstablishmentData> => {
  logger.info(`Fetching Census establishment data for year ${year}`);

  const url = `https://api.census.gov/data/${year}/cbp?get=ESTAB,NAICS2017_LABEL&for=state:*&NAICS2017=44-45`;

  try {
    const response = await axios.get(url);

    const data = response.data as [string, string, string, string][];

    const establishments: CensusEstablishmentData = {};

    for (const [estab, , , stateCode] of data.slice(1)) {
      const stateAbbr = STATE_CODE_TO_ABBR[stateCode];
      if (stateAbbr && Object.values(States).includes(stateAbbr as States)) {
        establishments[stateAbbr] = parseInt(estab, 10) || 0;
      }
    }

    logger.info(
      `Successfully fetched establishment data for ${Object.keys(establishments).length} states`,
    );
    return establishments;
  } catch (error) {
    // Log error details without the full error object to avoid source code in logs
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code: string })?.code || 'UNKNOWN';
    logger.error(
      `Failed to fetch Census establishment data for year ${year}: ${errorMessage} (code: ${errorCode})`,
    );
    throw new Error(
      `Failed to fetch Census establishment data for year ${year}`,
    );
  }
};

export const fetchCensusPopulationData = async (
  year: number,
): Promise<CensusPopulationData> => {
  logger.info(`Fetching Census population data for year ${year}`);

  const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,B01003_001E&for=state:*`;

  try {
    const response = await axios.get(url);

    const data = response.data as [string, string, string, string][];

    const population: CensusPopulationData = {};

    for (const [, pop, stateCode] of data.slice(1)) {
      const stateAbbr = STATE_CODE_TO_ABBR[stateCode];
      if (stateAbbr && Object.values(States).includes(stateAbbr as States)) {
        population[stateAbbr] = parseInt(pop, 10) || 0;
      }
    }

    logger.info(
      `Successfully fetched population data for ${Object.keys(population).length} states`,
    );
    return population;
  } catch (error) {
    // Log error details without the full error object to avoid source code in logs
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code: string })?.code || 'UNKNOWN';
    logger.error(
      `Failed to fetch Census population data for year ${year}: ${errorMessage} (code: ${errorCode})`,
    );
    throw new Error(`Failed to fetch Census population data for year ${year}`);
  }
};

export const fetchCensusData = async (year: number): Promise<CensusData> => {
  logger.info(`Fetching complete Census data for year ${year}`);

  const [establishments, population] = await Promise.all([
    fetchCensusEstablishmentData(year),
    fetchCensusPopulationData(year),
  ]);

  return {
    establishments,
    population,
    year,
  };
};
