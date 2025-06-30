import { StateScore } from './states';

export interface BlockbusterIndexResponse {
  metadata: {
    calculatedAt: string;
    totalStates: number;
    version: string;
    signalStatus: {
      total: number;
      successful: number;
      failed: number;
    };
  };
  states: Record<string, StateScore>;
}
