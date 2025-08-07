import { Signal } from '../types';

export const WEIGHTS: Record<Signal, number> = {
  [Signal.AMAZON]: 0.22, // 22.00%
  [Signal.CENSUS]: 0.11, // 11.00%
  [Signal.BROADBAND]: 0.22, // 22.00%
  [Signal.WALMART]: 0.11, // 11.00%
  [Signal.BLS_PHYSICAL]: 0.0, // 0.00% (removed)
  [Signal.BLS_ECOMMERCE]: 0.34, // 34.00%
};
