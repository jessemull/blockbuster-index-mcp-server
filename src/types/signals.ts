export enum Signal {
  AMAZON = 'AMAZON',
  CENSUS = 'CENSUS',
  BROADBAND = 'BROADBAND',
  WALMART = 'WALMART',
  BLS_PHYSICAL = 'BLS_PHYSICAL',
  BLS_ECOMMERCE = 'BLS_ECOMMERCE',
}

export interface SignalScoreRecord {
  signalType: string;
  timestamp: number;
  calculatedAt: string;
  scores: Record<string, number>;
}
