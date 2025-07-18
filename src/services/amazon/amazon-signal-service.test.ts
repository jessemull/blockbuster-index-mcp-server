const mockGetAmazonScores = jest.fn();

jest.mock('../../signals/amazon/get-amazon-scores', () => ({
  getAmazonScores: mockGetAmazonScores,
}));
jest.mock('../../util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { AmazonSignalService } from './amazon-signal-service';
import { logger } from '../../util';
import { States } from '../../types';
import type { JobSignalRecord, SignalRepository } from '../../types/amazon';

interface AmazonSignalServiceWithPrivate {
  getStartOfDayTimestamp(date?: Date): number;
}

describe('AmazonSignalService', () => {
  let service: AmazonSignalService;
  let mockRepository: jest.Mocked<SignalRepository<JobSignalRecord>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      exists: jest.fn(),
      query: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<SignalRepository<JobSignalRecord>>;

    service = new AmazonSignalService(mockRepository);
  });

  describe('constructor', () => {
    it('creates service with repository', () => {
      expect(service).toBeInstanceOf(AmazonSignalService);
    });
  });

  describe('collectAndStoreSignals', () => {
    it('successfully collects and stores signals', async () => {
      const mockTimestamp = 1750809600;

      jest
        .spyOn(
          service as unknown as AmazonSignalServiceWithPrivate,
          'getStartOfDayTimestamp',
        )
        .mockReturnValue(mockTimestamp);
      mockGetAmazonScores.mockResolvedValue({ CA: 42, TX: 30, NY: 25 });

      await service.collectAndStoreSignals();

      expect(mockGetAmazonScores).toHaveBeenCalledWith();
      expect(logger.info).toHaveBeenCalledWith(
        'Starting Amazon signal collection and storage',
        {
          timestamp: mockTimestamp,
          totalStates: Object.keys(States).length,
        },
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully completed Amazon signal collection and storage',
        {
          timestamp: mockTimestamp,
          totalJobs: 97,
          totalStates: 3,
        },
      );
    });

    it('handles errors during collection', async () => {
      const mockTimestamp = 1750809600;
      jest
        .spyOn(
          service as unknown as AmazonSignalServiceWithPrivate,
          'getStartOfDayTimestamp',
        )
        .mockReturnValue(mockTimestamp);
      mockGetAmazonScores.mockRejectedValue(new Error('Collection failed'));

      await expect(service.collectAndStoreSignals()).rejects.toThrow(
        'Collection failed',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to collect and store Amazon signals',
        {
          error: 'Collection failed',
          timestamp: mockTimestamp,
        },
      );
    });

    it('handles non-Error exceptions', async () => {
      const mockTimestamp = 1750809600;
      jest
        .spyOn(
          service as unknown as AmazonSignalServiceWithPrivate,
          'getStartOfDayTimestamp',
        )
        .mockReturnValue(mockTimestamp);
      mockGetAmazonScores.mockRejectedValue('String error');

      await expect(service.collectAndStoreSignals()).rejects.toBe(
        'String error',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to collect and store Amazon signals',
        {
          error: 'String error',
          timestamp: mockTimestamp,
        },
      );
    });
  });

  describe('getSignalsForDateRange', () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-02T00:00:00Z');
    let startTimestamp: number;
    let endTimestamp: number;

    const mockRecords: JobSignalRecord[] = [
      { state: 'CA', timestamp: 1234567890, jobCount: 42 },
      { state: 'TX', timestamp: 1234567890, jobCount: 30 },
    ];

    beforeEach(() => {
      const serviceWithPrivate =
        service as unknown as AmazonSignalServiceWithPrivate;
      startTimestamp = serviceWithPrivate.getStartOfDayTimestamp(startDate);
      endTimestamp = serviceWithPrivate.getStartOfDayTimestamp(endDate);
    });

    it('successfully retrieves signals for date range', async () => {
      (mockRepository.query as jest.Mock).mockResolvedValue(mockRecords);

      const result = await service.getSignalsForDateRange(startDate, endDate);

      expect(mockRepository.query).toHaveBeenCalledTimes(
        Object.keys(States).length,
      );
      Object.values(States).forEach((state) => {
        expect(mockRepository.query).toHaveBeenCalledWith(
          state,
          startTimestamp,
          endTimestamp,
        );
      });

      expect(result.length).toBe(
        mockRecords.length * Object.keys(States).length,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Retrieved Amazon signal records for date range',
        {
          endDate: endDate.toISOString(),
          recordCount: result.length,
          startDate: startDate.toISOString(),
        },
      );
    });

    it('handles empty results from repository', async () => {
      (mockRepository.query as jest.Mock).mockResolvedValue([]);

      const result = await service.getSignalsForDateRange(startDate, endDate);

      expect(result).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith(
        'Retrieved Amazon signal records for date range',
        {
          endDate: endDate.toISOString(),
          recordCount: 0,
          startDate: startDate.toISOString(),
        },
      );
    });

    it('handles errors during retrieval', async () => {
      (mockRepository.query as jest.Mock).mockRejectedValue(
        new Error('Query failed'),
      );

      await expect(
        service.getSignalsForDateRange(startDate, endDate),
      ).rejects.toThrow('Query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to retrieve Amazon signals for date range',
        {
          endDate: endDate.toISOString(),
          error: 'Query failed',
          startDate: startDate.toISOString(),
        },
      );
    });

    it('handles non-Error exceptions during retrieval', async () => {
      (mockRepository.query as jest.Mock).mockRejectedValue('String error');

      await expect(
        service.getSignalsForDateRange(startDate, endDate),
      ).rejects.toBe('String error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to retrieve Amazon signals for date range',
        {
          endDate: endDate.toISOString(),
          error: 'String error',
          startDate: startDate.toISOString(),
        },
      );
    });

    it('throws error when repository query method is not implemented', async () => {
      const mockRepositoryWithoutQuery = {
        exists: jest.fn(),
        save: jest.fn(),
      } as unknown as jest.Mocked<SignalRepository<JobSignalRecord>>;

      const serviceWithoutQuery = new AmazonSignalService(
        mockRepositoryWithoutQuery,
      );

      await expect(
        serviceWithoutQuery.getSignalsForDateRange(startDate, endDate),
      ).rejects.toThrow('Query method not implemented for this repository');
    });
  });
});

describe('AmazonSignalService - getStartOfDayTimestamp', () => {
  let service: AmazonSignalService;
  let mockRepository: jest.Mocked<SignalRepository<JobSignalRecord>>;
  let serviceWithPrivate: AmazonSignalServiceWithPrivate;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    mockRepository = {
      exists: jest.fn(),
      query: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<SignalRepository<JobSignalRecord>>;

    service = new AmazonSignalService(mockRepository);
    serviceWithPrivate = service as unknown as AmazonSignalServiceWithPrivate;
  });

  describe('getStartOfDayTimestamp', () => {
    it('returns start of day timestamp for current date', () => {
      const now = new Date('2023-01-15T14:30:00Z');
      const expected = Math.floor(
        new Date('2023-01-15T00:00:00Z').getTime() / 1000,
      );

      const result = serviceWithPrivate.getStartOfDayTimestamp(now);
      expect(result).toBe(expected);
    });

    it('returns start of day timestamp for provided date', () => {
      const inputDate = new Date('2023-06-20T18:45:00Z');
      const expected = Math.floor(
        new Date('2023-06-20T00:00:00Z').getTime() / 1000,
      );

      const result = serviceWithPrivate.getStartOfDayTimestamp(inputDate);
      expect(result).toBe(expected);
    });

    it('returns start of day timestamp when no date is provided (uses current date)', () => {
      const result = serviceWithPrivate.getStartOfDayTimestamp();

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);

      const resultDate = new Date(result * 1000);
      expect(resultDate.getUTCHours()).toBe(0);
      expect(resultDate.getUTCMinutes()).toBe(0);
      expect(resultDate.getUTCSeconds()).toBe(0);
      expect(resultDate.getUTCMilliseconds()).toBe(0);
    });
  });
});
