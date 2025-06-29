import { getCensusScores } from '../../src/signals';

console.log('Starting Census signal collection and storage...');

getCensusScores()
  .then((scores) => {
    console.log('Census scores: ', scores);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error collecting Census signals: ', error);
    process.exit(1);
  });
