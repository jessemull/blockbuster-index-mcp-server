module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!src/types/**',
    '!dev/**',
    '!**/index.ts',
    '!src/constants/retry.ts',
    '!src/constants/weights.ts',
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
  moduleNameMapper: {
    '^puppeteer$': '<rootDir>/__mocks__/puppeteer.js',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dev/',
    ...(process.env.LOCALSTACK_ENDPOINT ? [] : ['\\.localstack\\.test\\.ts$']),
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
