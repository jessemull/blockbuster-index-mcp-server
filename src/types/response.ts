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

export interface BlockbusterIndexRecord {
  timestamp: number;
  calculatedAt: string;
  version: string;
  totalStates: number;
  states: Record<string, StateScore>;
  signalStatus: {
    total: number;
    successful: number;
    failed: number;
  };
}
