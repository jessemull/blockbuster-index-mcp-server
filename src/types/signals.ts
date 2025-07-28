export enum Signal {
  AMAZON = 'AMAZON',
  CENSUS = 'CENSUS',
  BROADBAND = 'BROADBAND',
  WALMART = 'WALMART',
  BLS = 'BLS',
}

export interface SignalScoreRecord {
  signalType: string;
  timestamp: number;
  calculatedAt: string;
  scores: Record<string, number>;
}
