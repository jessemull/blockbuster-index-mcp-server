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

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
