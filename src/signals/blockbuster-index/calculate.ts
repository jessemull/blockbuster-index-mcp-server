import { WEIGHTS } from '../../constants';
import { SIGNALS } from '../../constants/signals';
import {
  States,
  Signal,
  StateScore,
  BlockbusterIndexResponse,
} from '../../types';
import { normalizeScores } from '../../util/helpers/normalize-signal-scores';

export function calculateBlockbusterIndex(
  signalResults: Record<Signal, Record<string, number>>,
  version: string = 'dev',
): BlockbusterIndexResponse {
  // Normalize all signals to 0-100 and apply inversion if needed...

  const normalizedSignals: Record<
    Signal,
    Record<string, number>
  > = {} as Record<Signal, Record<string, number>>;
  for (const { signal, inverted } of SIGNALS) {
    const rawScores = signalResults[signal];

    if (!rawScores) continue;

    const normalized = normalizeScores(rawScores);

    if (inverted) {
      normalizedSignals[signal] = Object.fromEntries(
        Object.entries(normalized).map(([state, value]) => [
          state,
          100 - value,
        ]),
      );
    } else {
      normalizedSignals[signal] = normalized;
    }
  }

  const states: Record<string, StateScore> = {};

  for (const state of Object.values(States)) {
    const components = {
      [Signal.AMAZON]: normalizedSignals[Signal.AMAZON]?.[state] ?? 0,
      [Signal.CENSUS]: normalizedSignals[Signal.CENSUS]?.[state] ?? 0,
      [Signal.BROADBAND]: normalizedSignals[Signal.BROADBAND]?.[state] ?? 0,
      [Signal.WALMART]: normalizedSignals[Signal.WALMART]?.[state] ?? 0,
      [Signal.BLS_PHYSICAL]:
        normalizedSignals[Signal.BLS_PHYSICAL]?.[state] ?? 0,
      [Signal.BLS_ECOMMERCE]:
        normalizedSignals[Signal.BLS_ECOMMERCE]?.[state] ?? 0,
    };

    const score = Object.entries(components).reduce(
      (sum, [signal, value]) => sum + value * WEIGHTS[signal as Signal],
      0,
    );

    states[state] = {
      score: parseFloat(score.toFixed(2)),
      components,
    };
  }

  const calculatedAt = new Date().toISOString();

  return {
    states,
    metadata: {
      calculatedAt,
      version,
      totalStates: Object.keys(states).length,
      signalStatus: {
        total: SIGNALS.length,
        successful: SIGNALS.length,
        failed: 0,
      },
    },
  };
}
