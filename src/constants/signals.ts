import { Signal } from '../types/signals';

export const SIGNALS = [
  { name: 'amazon', signal: Signal.AMAZON, inverted: false },
  { name: 'census', signal: Signal.CENSUS, inverted: true },
  { name: 'broadband', signal: Signal.BROADBAND, inverted: false },
  { name: 'walmart-physical', signal: Signal.WALMART_PHYSICAL, inverted: true },
  {
    name: 'walmart-technology',
    signal: Signal.WALMART_TECHNOLOGY,
    inverted: false,
  },
];
