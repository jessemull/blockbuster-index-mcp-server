import { StateScore } from './states';

export interface BlockbusterIndexResponse {
  metadata: {
    calculatedAt: string;
    totalStates: number;
    version: string;
  };
  states: Record<string, StateScore>;
}

export interface BlockbusterIndexRecord {
  calculatedAt: string;
  states: Record<string, StateScore>;
  timestamp: number;
  totalStates: number;
  version: string;
}
