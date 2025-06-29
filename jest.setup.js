// Global logger mock to suppress console output during tests
// This provides a default mock that can be overridden by individual tests

// Mock the logger module with a default mock
jest.mock('./src/util/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    errorWithContext: jest.fn(),
    endOperation: jest.fn(),
    performance: jest.fn(),
    signal: jest.fn(),
    startOperation: jest.fn(),
  },
}));

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
