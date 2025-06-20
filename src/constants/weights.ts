import { Signal } from '../types';

export const WEIGHTS: Record<Signal, number> = {
  [Signal.AMAZON]: 0.1,
  [Signal.ANALOG]: 0.1,
  [Signal.BROADBAND]: 0.2,
  [Signal.ECOMMERCE]: 0.2,
  [Signal.PHYSICAL]: 0.15,
  [Signal.STREAMING]: 0.15,
  [Signal.WALMART]: 0.1,
};
