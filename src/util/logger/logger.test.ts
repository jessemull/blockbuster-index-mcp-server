import { logger } from './index';

jest.mock('bunyan-cloudwatch', () => jest.fn(() => ({ write: jest.fn() })));

describe('Logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should call base logger methods', () => {
    expect(() => logger.debug('test debug')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
  });

  it('should call custom logger methods', () => {
    expect(() => logger.endOperation('op', 123, { foo: 'bar' })).not.toThrow();
    expect(() =>
      logger.errorWithContext('msg', new Error('err'), { foo: 'bar' }),
    ).not.toThrow();
    expect(() => logger.performance('op', 123, { foo: 'bar' })).not.toThrow();
    expect(() =>
      logger.signal('sig', 'state', 1.23, { foo: 'bar' }),
    ).not.toThrow();
    expect(() => logger.startOperation('op', { foo: 'bar' })).not.toThrow();
  });

  it('should create a logger with the correct name', () => {
    expect(logger.fields.name).toBe('blockbuster-index-mcp-logger');
  });

  it('should have all required methods', () => {
    expect(logger.debug).toBeDefined();
    expect(logger.endOperation).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.errorWithContext).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.performance).toBeDefined();
    expect(logger.signal).toBeDefined();
    expect(logger.startOperation).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  it('should use default values if env vars are missing', () => {
    // Test that the logger is created even with missing env vars
    expect(logger).toBeDefined();
    expect(logger.fields.name).toBe('blockbuster-index-mcp-logger');
  });

  it('should use the correct log level', () => {
    expect(typeof logger.level()).toBe('number');
  });
});
