import { Signal } from '../types';

export const WEIGHTS: Record<Signal, number> = {
  [Signal.AMAZON]: 0.25, // 25.00%
  [Signal.CENSUS]: 0.0833, // 8.33%
  [Signal.BROADBAND]: 0.1667, // 16.67%
  [Signal.WALMART]: 0.0833, // 8.33%
  [Signal.BLS_PHYSICAL]: 0.0833, // 8.33%
  [Signal.BLS_ECOMMERCE]: 0.3333, // 33.33%
};
