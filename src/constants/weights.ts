import { Signal } from '../types';

export const WEIGHTS: Record<Signal, number> = {
  [Signal.AMAZON]: 0.25,
  [Signal.CENSUS]: 0.25,
  [Signal.BROADBAND]: 0.25,
  [Signal.WALMART_PHYSICAL]: 0.125,
  [Signal.WALMART_TECHNOLOGY]: 0.125,
};
