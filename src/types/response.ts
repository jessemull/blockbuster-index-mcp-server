import { StateScore } from './states';

export interface BlockbusterIndexResponse {
  metadata: {
    calculatedAt: string;
    signalStatus: {
      failed: number;
      successful: number;
      total: number;
    };
    totalStates: number;
    version: string;
  };
  states: Record<string, StateScore>;
}

export interface BlockbusterIndexRecord {
  calculatedAt: string;
  signalStatus: {
    failed: number;
    successful: number;
    total: number;
  };
  states: Record<string, StateScore>;
  timestamp: number;
  totalStates: number;
  version: string;
}
