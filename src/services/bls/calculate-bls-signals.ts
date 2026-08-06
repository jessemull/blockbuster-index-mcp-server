import type { BlsSignalRecord } from '../../types/bls';
import { DynamoDBBlsRepository } from '../../repositories/bls/bls-repository';
import { logger } from '../../util';
import { computeWeightedCodeSlopes } from './compute-weighted-code-slopes';

/**
 * Calculates physical and ecommerce BLS signals for all states and persists them.
 */
export async function calculateAllSignals(
  repository: DynamoDBBlsRepository,
): Promise<void> {
  try {
    logger.info('Calculating BLS signals for all states...');

    // Get all unique states...

    const states = await repository.getAllUniqueStates();
    logger.info(`Found ${states.length} states to process`);

    if (states.length === 0) {
      logger.warn('No states found for signal calculation');
      return;
    }

    // Calculate signals for all states and collect slopes for normalization...

    const stateSignals: Array<{
      dataPoints: number;
      ecommerceSlope: number;
      ecommerceTrend: 'declining' | 'growing' | 'stable';
      physicalSlope: number;
      physicalTrend: 'declining' | 'growing' | 'stable';
      state: string;
      yearsAnalyzed: number[];
    }> = [];

    // Process states in batches to avoid memory issues...

    const batchSize = 5;
    const batches = Math.ceil(states.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = states.slice(i * batchSize, (i + 1) * batchSize);
      logger.info(
        `Processing batch ${i + 1}/${batches} (${batch.length} states)`,
      );

      const batchPromises = batch.map(async (state) => {
        try {
          logger.info(`Processing signal for state ${state}...`);
          const stateData = await repository.getAllStateDataForState(state);

          if (!stateData || stateData.length === 0) {
            logger.warn(`No state data found for ${state}`);
            return null;
          }

          // Sort by year...

          const sortedData = stateData.sort((a, b) => a.year - b.year);

          // Calculate physical retail signal using weighted approach (same as ecommerce)...

          const physical = computeWeightedCodeSlopes(
            sortedData,
            'brickAndMortarCodes',
          );

          // Calculate e-commerce signal using weighted approach...

          const ecommerce = computeWeightedCodeSlopes(
            sortedData,
            'ecommerceCodes',
          );

          return {
            dataPoints: physical.dataPoints,
            ecommerceSlope: ecommerce.slope,
            ecommerceTrend: ecommerce.trend,
            physicalSlope: physical.slope,
            physicalTrend: physical.trend,
            state,
            yearsAnalyzed: sortedData.map((d) => d.year),
          };
        } catch (error) {
          logger.error(`Error calculating signal for state ${state}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result) => result !== null);
      stateSignals.push(...validResults);

      logger.info(`Processed ${batch.length} states`);

      // Add a small delay between batches to prevent throttling...

      if (i < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Normalize slopes using z-score across all states...

    const physicalSlopes = stateSignals.map((s) => s.physicalSlope);
    const ecommerceSlopes = stateSignals.map((s) => s.ecommerceSlope);

    const physicalMean =
      physicalSlopes.reduce((sum, slope) => sum + slope, 0) /
      physicalSlopes.length;
    const ecommerceMean =
      ecommerceSlopes.reduce((sum, slope) => sum + slope, 0) /
      ecommerceSlopes.length;

    const physicalStd = Math.sqrt(
      physicalSlopes.reduce(
        (sum, slope) => sum + Math.pow(slope - physicalMean, 2),
        0,
      ) / physicalSlopes.length,
    );
    const ecommerceStd = Math.sqrt(
      ecommerceSlopes.reduce(
        (sum, slope) => sum + Math.pow(slope - ecommerceMean, 2),
        0,
      ) / ecommerceSlopes.length,
    );

    logger.info(
      `Normalization stats: Physical mean=${physicalMean.toFixed(4)}, std=${physicalStd.toFixed(4)}`,
    );
    logger.info(
      `Normalization stats: E-commerce mean=${ecommerceMean.toFixed(4)}, std=${ecommerceStd.toFixed(4)}`,
    );

    // Calculate normalized scores and save signals...

    for (const signal of stateSignals) {
      try {
        // Calculate z-scores...

        const physicalZScore =
          (signal.physicalSlope - physicalMean) / physicalStd;
        const ecommerceZScore =
          (signal.ecommerceSlope - ecommerceMean) / ecommerceStd;

        // Invert physical retail signal (decline = higher score)...

        const physicalComponent = -physicalZScore;
        const ecommerceComponent = ecommerceZScore;

        // Convert to 0-100 scale...

        const physicalScore = Math.max(
          0,
          Math.min(100, 50 + physicalComponent * 15),
        );
        const ecommerceScore = Math.max(
          0,
          Math.min(100, 50 + ecommerceComponent * 15),
        );

        const signalRecord: BlsSignalRecord = {
          calculatedAt: new Date().toISOString(),
          dataPoints: signal.dataPoints,
          ecommerceScore,
          ecommerceSlope: signal.ecommerceSlope,
          ecommerceTrend: signal.ecommerceTrend,
          physicalScore,
          physicalSlope: signal.physicalSlope,
          physicalTrend: signal.physicalTrend,
          state: signal.state,
          timestamp: Math.floor(Date.now() / 1000),
          yearsAnalyzed: signal.yearsAnalyzed,
        };

        await repository.saveSignal(signalRecord);

        logger.info(
          `Calculated signal for ${signal.state}: physicalScore=${physicalScore.toFixed(2)} (${signal.dataPoints} points, ${signal.yearsAnalyzed.length} years), ecommerceScore=${ecommerceScore.toFixed(2)}`,
        );
      } catch (error) {
        logger.error(`Error saving signal for ${signal.state}:`, error);
      }
    }

    logger.info(`Calculated signals for ${stateSignals.length} states`);
  } catch (error) {
    logger.error('Error calculating all signals:', error);
    throw error;
  }
}
