import { Signal } from '../types/signals';

export const SIGNALS = [
  { name: 'amazon', signal: Signal.AMAZON, inverted: false },
  { name: 'census', signal: Signal.CENSUS, inverted: true },
  { name: 'broadband', signal: Signal.BROADBAND, inverted: false },
  { name: 'walmart', signal: Signal.WALMART, inverted: true },
  { name: 'bls-physical', signal: Signal.BLS_PHYSICAL, inverted: false },
  { name: 'bls-ecommerce', signal: Signal.BLS_ECOMMERCE, inverted: false },
];
