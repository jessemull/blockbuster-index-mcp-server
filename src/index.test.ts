import * as signals from './signals';
import fs from 'fs';
import path from 'path';
import { Signal, States } from './types';
import { WEIGHTS } from './constants';
import { logger } from './util';
import { main } from './index';

jest.mock('fs');
jest.mock('path');
jest.mock('./signals');
jest.mock('./util', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('main()', () => {
  const mockScores = {
    [States.AK]: 1,
    [States.AR]: 2,
  };

  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env = { ...OLD_ENV, NODE_ENV: 'production' };

    (signals.getAmazonScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getAnalogScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getCommerceScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getPhysicalScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getStreamingScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getWalmartScores as jest.Mock).mockResolvedValue(mockScores);

    (path.resolve as jest.Mock).mockReturnValue('/fake/dev/scores');
    (path.join as jest.Mock).mockReturnValue(
      '/fake/dev/scores/blockbuster-index.json',
    );

    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('calculates scores and logs JSON in production mode', async () => {
    await main();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('"score":'),
    );
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('calculates scores and writes file in development mode', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };

    await main();

    expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/dev/scores', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/fake/dev/scores/blockbuster-index.json',
      expect.stringContaining('"score":'),
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Combined scores written to'),
    );
  });

  it('handles missing state keys by defaulting to 0', async () => {
    (signals.getAmazonScores as jest.Mock).mockResolvedValue({});

    await main();

    expect(logger.info).toHaveBeenCalled();
  });

  it('calls process.exit(1) and logs error on failure', async () => {
    const error = new Error('fail');
    (signals.getAmazonScores as jest.Mock).mockRejectedValue(error);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as never);

    await expect(main()).rejects.toThrow('process.exit: 1');
    expect(logger.error).toHaveBeenCalledWith(
      'Blockbuster index calculation failed: ',
      'fail',
    );

    exitSpy.mockRestore();
  });

  it('computes correct weighted scores based on WEIGHTS constant', async () => {
    const customScores = {
      [States.AL]: 1,
      [States.AK]: 2,
    };
    (signals.getAmazonScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getAnalogScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getCommerceScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getPhysicalScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getStreamingScores as jest.Mock).mockResolvedValue(customScores);
    (signals.getWalmartScores as jest.Mock).mockResolvedValue(customScores);

    await main();

    const loggedArg = (logger.info as jest.Mock).mock.calls[0][0];
    const result = JSON.parse(loggedArg);

    for (const state of Object.values(States)) {
      const s = state as keyof typeof customScores;
      const expectedScore =
        (customScores[s] ?? 0) * WEIGHTS[Signal.AMAZON] +
        (customScores[s] ?? 0) * WEIGHTS[Signal.ANALOG] +
        (customScores[s] ?? 0) * WEIGHTS[Signal.BROADBAND] +
        (customScores[s] ?? 0) * WEIGHTS[Signal.ECOMMERCE] +
        (customScores[s] ?? 0) * WEIGHTS[Signal.PHYSICAL] +
        (customScores[s] ?? 0) * WEIGHTS[Signal.STREAMING] +
        (customScores[s] ?? 0) * WEIGHTS[Signal.WALMART];

      expect(result[s].score).toBeCloseTo(expectedScore, 2);
    }
  });
});
