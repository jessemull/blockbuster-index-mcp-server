import { getBroadbandScores } from './get-broadband-scores';
import { BroadbandService } from '../../services';
import { logger } from '../../util/logger';

jest.mock('../../services');

jest.mock('../../util/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockBroadbandService = BroadbandService as jest.MockedClass<
  typeof BroadbandService
>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('getBroadbandScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BROADBAND_DYNAMODB_TABLE_NAME = 'mock-table';
  });

  it('should process broadband data and return scores', async () => {
    const mockProcessBroadbandData = jest.fn().mockResolvedValue(undefined);
    mockBroadbandService.prototype.processBroadbandData =
      mockProcessBroadbandData;

    const result = await getBroadbandScores();

    expect(mockProcessBroadbandData).toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should handle errors gracefully', async () => {
    const mockProcessBroadbandData = jest
      .fn()
      .mockRejectedValue(new Error('S3 error'));
    mockBroadbandService.prototype.processBroadbandData =
      mockProcessBroadbandData;

    await expect(getBroadbandScores()).rejects.toThrow('S3 error');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error getting broadband scores:',
      expect.any(Error),
    );
  });

  it('should work without repository when table name is not set', async () => {
    delete process.env.BROADBAND_DYNAMODB_TABLE_NAME;

    const mockProcessBroadbandData = jest.fn().mockResolvedValue(undefined);
    mockBroadbandService.prototype.processBroadbandData =
      mockProcessBroadbandData;

    const result = await getBroadbandScores();

    expect(result).toEqual({});
  });
});
