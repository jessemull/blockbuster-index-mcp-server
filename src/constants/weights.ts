import { Signal } from '../types';

export const WEIGHTS: Record<Signal, number> = {
  [Signal.AMAZON]: 0.25,
  [Signal.CENSUS]: 0.075,
  [Signal.BROADBAND]: 0.2,
  [Signal.WALMART]: 0.075,
  [Signal.BLS_PHYSICAL]: 0.1,
  [Signal.BLS_ECOMMERCE]: 0.3,
};
