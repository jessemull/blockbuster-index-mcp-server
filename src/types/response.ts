import { StateScore } from './states';

export interface BlockbusterIndexResponse {
  metadata: {
    calculatedAt: string;
    totalStates: number;
    version: string;
  };
  states: Record<string, StateScore>;
}
