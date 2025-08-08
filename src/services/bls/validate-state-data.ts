import type { BlsStateData } from '../../types/bls';
import { logger } from '../../util';

export function validateStateData(data: BlsStateData): boolean {
  if (!data.state || typeof data.state !== 'string') {
    logger.warn('Invalid state in data', { data });
    return false;
  }

  if (!data.year || typeof data.year !== 'number') {
    logger.warn('Invalid year in data', { data });
    return false;
  }

  const hasBrickAndMortarData =
    Object.keys(data.brickAndMortarCodes).length > 0;

  const hasEcommerceData = Object.keys(data.ecommerceCodes).length > 0;

  if (!hasBrickAndMortarData && !hasEcommerceData) {
    logger.info('No valid code data in state data', { data });
    return false;
  }

  return true;
}
