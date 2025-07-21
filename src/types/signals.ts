export enum Signal {
  AMAZON = 'AMAZON',
  CENSUS = 'CENSUS',
  BROADBAND = 'BROADBAND',
  WALMART_PHYSICAL = 'WALMART_PHYSICAL',
  WALMART_TECHNOLOGY = 'WALMART_TECHNOLOGY',
}

export interface SignalScoreRecord {
  signalType: string;
  timestamp: number;
  calculatedAt: string;
  scores: Record<string, number>;
}
