import { APIGatewayProxyHandler } from 'aws-lambda';
import { Signal, States } from './types';
import { WEIGHTS } from './constants';
import {
  getAmazonScores,
  getAnalogScores,
  getBroadbandScores,
  getCommerceScores,
  getPhysicalScores,
  getStreamingScores,
  getWalmartScores,
} from './signals';
import { logger, InternalServerError } from './util';

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const [amazon, analog, broadband, ecommerce, media, streaming, walmart] =
      await Promise.all([
        getAmazonScores(),
        getAnalogScores(),
        getBroadbandScores(),
        getCommerceScores(),
        getPhysicalScores(),
        getStreamingScores(),
        getWalmartScores(),
      ]);

    const response: Record<
      States,
      { score: number; components: Record<Signal, number> }
    > = {} as Record<
      States,
      { score: number; components: Record<Signal, number> }
    >;

    for (const state of Object.values(States)) {
      const components = {
        [Signal.AMAZON]: amazon[state as States] ?? 0,
        [Signal.ANALOG]: analog[state as States] ?? 0,
        [Signal.BROADBAND]: broadband[state as States] ?? 0,
        [Signal.ECOMMERCE]: ecommerce[state as States] ?? 0,
        [Signal.PHYSICAL]: media[state as States] ?? 0,
        [Signal.STREAMING]: streaming[state as States] ?? 0,
        [Signal.WALMART]: walmart[state as States] ?? 0,
      };

      const score = Object.entries(components).reduce(
        (sum, [signal, value]) => sum + value * WEIGHTS[signal as Signal],
        0,
      );

      response[state] = {
        score: parseFloat(score.toFixed(2)),
        components,
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response, null, 2),
    };
  } catch (err) {
    logger.error(
      'Blockbuster index calculation failed: ',
      (err as Error).message,
    );
    return new InternalServerError(
      'There was an error calculating the blockbuster index!',
    ).build();
  }
};
