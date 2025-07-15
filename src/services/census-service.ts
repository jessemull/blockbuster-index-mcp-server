import axios from 'axios';
import { States } from '../types';
import {
  CensusData,
  CensusEstablishmentData,
  CensusPopulationData,
} from '../types';
import { logger } from '../util';
import { STATE_CODE_TO_ABBR, CENSUS_ENDPOINTS } from '../constants';

export const fetchCensusEstablishmentData = async (
  year: number,
): Promise<CensusEstablishmentData> => {
  logger.info(`Fetching Census establishment data for year ${year}`);

  const url = CENSUS_ENDPOINTS.ESTABLISHMENT_DATA(year);

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

  const url = CENSUS_ENDPOINTS.POPULATION_DATA(year);

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
