import { JobSignalRecord, SignalRepository } from './amazon';
import {
  CensusSignalRecord,
  CensusData,
  CensusEstablishmentData,
  CensusPopulationData,
  CensusWorkforceData,
} from './census';
import {
  BroadbandSignalRecord,
  BroadbandMetrics,
  TechnologyCounts,
} from './broadband';
import { BlockbusterIndexResponse, BlockbusterIndexRecord } from './response';
import { Signal, SignalScoreRecord } from './signals';
import { StateScore, States } from './states';

export {
  JobSignalRecord,
  SignalRepository,
  CensusSignalRecord,
  CensusData,
  CensusEstablishmentData,
  CensusPopulationData,
  CensusWorkforceData,
  BroadbandSignalRecord,
  BroadbandMetrics,
  TechnologyCounts,
  BlockbusterIndexResponse,
  BlockbusterIndexRecord,
  Signal,
  SignalScoreRecord,
  StateScore,
  States,
};

export interface SignalConfig {
  name: string;
  signal: Signal;
  getter: () => Promise<Record<string, number>>;
}
