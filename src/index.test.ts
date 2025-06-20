import * as signals from './signals';
import * as utilModule from './util';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { Signal, States } from './types';
import { WEIGHTS } from './constants/weights';
import { handler } from './index';

jest.mock('./signals', () => ({
  getAmazonScores: jest.fn(),
  getAnalogScores: jest.fn(),
  getBroadbandScores: jest.fn(),
  getCommerceScores: jest.fn(),
  getPhysicalScores: jest.fn(),
  getStreamingScores: jest.fn(),
  getWalmartScores: jest.fn(),
}));

describe('Blockbuster Index MCP Handler', () => {
  const mockScores = {
    [States.CA]: 0.1,
    [States.TX]: 0.2,
    [States.NY]: 0.05,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return 200 and calculated scores for all states', async () => {
    (signals.getAmazonScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getAnalogScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getCommerceScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getPhysicalScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getStreamingScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getWalmartScores as jest.Mock).mockResolvedValue(mockScores);

    const result = (await handler(
      {} as APIGatewayProxyEvent,
      {} as Context,
      () => {},
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(result.body).toBeDefined();

    const body = JSON.parse(result.body);

    expect(Object.keys(body).length).toBe(Object.values(States).length);

    const state = States.CA;
    const components = body[state].components;

    expect(components[Signal.AMAZON]).toBeCloseTo(mockScores[state]);
    expect(components[Signal.ANALOG]).toBeCloseTo(mockScores[state]);
    expect(components[Signal.BROADBAND]).toBeCloseTo(mockScores[state]);
    expect(components[Signal.ECOMMERCE]).toBeCloseTo(mockScores[state]);
    expect(components[Signal.PHYSICAL]).toBeCloseTo(mockScores[state]);
    expect(components[Signal.STREAMING]).toBeCloseTo(mockScores[state]);
    expect(components[Signal.WALMART]).toBeCloseTo(mockScores[state]);

    const expectedScore = Object.entries(components).reduce(
      (sum, [signal, value]) =>
        sum + (value as number) * WEIGHTS[signal as Signal],
      0,
    );

    expect(body[state].score).toBeCloseTo(parseFloat(expectedScore.toFixed(2)));
  });

  it('should default missing scores to zero', async () => {
    (signals.getAmazonScores as jest.Mock).mockResolvedValue({
      [States.CA]: 0.1,
    });
    (signals.getAnalogScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getBroadbandScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getCommerceScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getPhysicalScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getStreamingScores as jest.Mock).mockResolvedValue(mockScores);
    (signals.getWalmartScores as jest.Mock).mockResolvedValue(mockScores);

    const result = (await handler(
      {} as APIGatewayProxyEvent,
      {} as Context,
      () => {},
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);

    expect(body[States.TX].components[Signal.AMAZON]).toBe(0);
    expect(body[States.NY].components[Signal.AMAZON]).toBe(0);
    expect(body[States.CA].components[Signal.AMAZON]).toBe(0.1);
  });

  it('should log error and return 500 on exception', async () => {
    const spyLogger = jest
      .spyOn(utilModule.logger, 'error')
      .mockImplementation();
    (signals.getAmazonScores as jest.Mock).mockRejectedValue(
      new Error('AWS failure'),
    );

    const result = (await handler(
      {} as APIGatewayProxyEvent,
      {} as Context,
      () => {},
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain(
      'There was an error calculating the blockbuster index!',
    );
    expect(spyLogger).toHaveBeenCalledWith(
      'Blockbuster index calculation failed: ',
      'AWS failure',
    );

    spyLogger.mockRestore();
  });
});
