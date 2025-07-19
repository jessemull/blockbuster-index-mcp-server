import { JobSignalRecord, SignalRepository } from './amazon';
import {
  CensusSignalRecord,
  CensusData,
  CensusEstablishmentData,
  CensusPopulationData,
} from './census';
import {
  BroadbandSignalRecord,
  BroadbandMetrics,
  TechnologyCounts,
} from './broadband';
import { BlockbusterIndexResponse } from './response';
import { Signal } from './signals';
import { StateScore, States } from './states';

export {
  JobSignalRecord,
  SignalRepository,
  CensusSignalRecord,
  CensusData,
  CensusEstablishmentData,
  CensusPopulationData,
  BroadbandSignalRecord,
  BroadbandMetrics,
  TechnologyCounts,
  BlockbusterIndexResponse,
  Signal,
  StateScore,
  States,
};

export interface SignalConfig {
  name: string;
  signal: Signal;
  getter: () => Promise<Record<string, number>>;
}

export interface SignalScoreRecord {
  signalType: string;
  timestamp: number;
  calculatedAt: string;
  scores: Record<string, number>;
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
