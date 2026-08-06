import { Signal } from './signals';

export * from './amazon';
export * from './broadband';
export * from './browser';
export * from './census';
export * from './repository';
export * from './response';
export * from './signals';
export * from './states';
export * from './walmart';

export interface SignalConfig {
  getter: () => Promise<Record<string, number>>;
  name: string;
  signal: Signal;
}
