import { Signal } from '../types/signals';

export const SIGNALS = [
  { name: 'amazon', signal: Signal.AMAZON, inverted: false },
  { name: 'census', signal: Signal.CENSUS, inverted: true },
  { name: 'broadband', signal: Signal.BROADBAND, inverted: false },
  { name: 'walmart', signal: Signal.WALMART, inverted: true },
  { name: 'bls', signal: Signal.BLS, inverted: true },
];
