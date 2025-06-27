import { getEqualScores } from './getEqualScores';

jest.mock('../../types', () => ({
  States: {
    CA: 'CA',
    TX: 'TX',
  },
}));

describe('getEqualScores', () => {
  it('returns 0.1 for all states', () => {
    expect(getEqualScores()).toEqual({ CA: 0.1, TX: 0.1 });
  });
});
