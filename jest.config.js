module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!src/types/**',
    '!dev/**',
    '!src/config/index.ts',
    '!src/constants/index.ts',
    '!src/constants/retry.ts',
    '!src/constants/weights.ts',
    '!src/signals/index.ts',
    '!src/util/index.ts',
    '!src/util/helpers/index.ts',
    '!src/util/logger/index.ts',
    '!src/util/s3/index.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/dev/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
};
