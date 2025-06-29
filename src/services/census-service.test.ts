import axios from 'axios';
import {
  fetchCensusEstablishmentData,
  fetchCensusPopulationData,
  fetchCensusData,
} from './census-service';
import { logger } from '../util';

jest.mock('axios');
jest.mock('../util/helpers/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CensusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCensusEstablishmentData', () => {
    it('parses establishment data correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          ['ESTAB', 'NAICS2017_LABEL', 'state', 'state_code'],
          ['123', 'Retail Trade', '44', '41'],
          ['456', 'Retail Trade', '44', '06'],
        ],
      });

      const result = await fetchCensusEstablishmentData(2022);
      expect(result).toEqual({ OR: 123, CA: 456 });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully'),
      );
    });

    it('ignores unknown state codes', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          ['ESTAB', 'NAICS2017_LABEL', 'state', 'state_code'],
          ['789', 'Retail Trade', '44', '99'],
        ],
      });

      const result = await fetchCensusEstablishmentData(2022);
      expect(result).toEqual({});
    });

    it('handles parseInt fallback gracefully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          ['ESTAB', 'NAICS2017_LABEL', 'state', 'state_code'],
          ['notanumber', 'Retail Trade', '44', '41'],
        ],
      });

      const result = await fetchCensusEstablishmentData(2022);
      expect(result).toEqual({ OR: 0 });
    });

    it('throws and logs on axios failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('network error'));

      await expect(fetchCensusEstablishmentData(2022)).rejects.toThrow(
        'Failed to fetch Census establishment data: Error: network error',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch Census establishment data:',
        expect.any(Error),
      );
    });
  });

  describe('fetchCensusPopulationData', () => {
    it('parses population data correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          ['NAME', 'B01003_001E', 'state'],
          ['Oregon', '4200000', '41'],
          ['California', '39000000', '06'],
        ],
      });

      const result = await fetchCensusPopulationData(2022);
      expect(result).toEqual({ OR: 4200000, CA: 39000000 });
    });

    it('handles bad values with fallback', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          ['NAME', 'B01003_001E', 'state'],
          ['Badland', 'NaN', '41'],
        ],
      });

      const result = await fetchCensusPopulationData(2022);
      expect(result).toEqual({ OR: 0 });
    });

    it('throws and logs on axios failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('population API fail'));

      await expect(fetchCensusPopulationData(2022)).rejects.toThrow(
        'Failed to fetch Census population data: Error: population API fail',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch Census population data:',
        expect.any(Error),
      );
    });
  });

  describe('fetchCensusData', () => {
    it('combines both data sources', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: [
            ['ESTAB', 'NAICS2017_LABEL', 'state', 'state_code'],
            ['10', '', '', '41'],
          ],
        })
        .mockResolvedValueOnce({
          data: [
            ['NAME', 'B01003_001E', 'state'],
            ['Oregon', '4200000', '41'],
          ],
        });

      const result = await fetchCensusData(2022);
      expect(result).toEqual({
        establishments: { OR: 10 },
        population: { OR: 4200000 },
        year: 2022,
      });
    });
  });
});
