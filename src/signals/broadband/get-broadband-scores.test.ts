import { CONFIG } from '../../config';
import { BroadbandService } from '../../services';
import { logger } from '../../util/logger';
import { getBroadbandScores } from './get-broadband-scores';

jest.mock('../../services');
jest.mock('../../config', () => ({
  CONFIG: {
    IS_DEVELOPMENT: false,
    BROADBAND_DYNAMODB_TABLE_NAME: 'mock-table' as string | undefined,
  },
}));

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
const mockCONFIG = CONFIG as jest.Mocked<typeof CONFIG>;

describe('getBroadbandScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCONFIG.IS_DEVELOPMENT = false;
    mockCONFIG.BROADBAND_DYNAMODB_TABLE_NAME = 'mock-table';
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
    mockCONFIG.IS_DEVELOPMENT = true;
    mockCONFIG.BROADBAND_DYNAMODB_TABLE_NAME = undefined;

    const mockProcessBroadbandData = jest.fn().mockResolvedValue(undefined);
    mockBroadbandService.prototype.processBroadbandData =
      mockProcessBroadbandData;

    const result = await getBroadbandScores();

    expect(result).toEqual({});
  });
});
