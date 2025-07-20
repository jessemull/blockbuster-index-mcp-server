import { logger } from './index';

jest.unmock('./index');
jest.unmock('./logger');

const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
const originalEnv = process.env;

beforeAll(() => {
  process.stdout.write = jest.fn();
  process.stderr.write = jest.fn();
});

afterAll(() => {
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  process.env = originalEnv;
});

describe('Logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should call base logger methods without throwing', () => {
    expect(() => logger.debug('test debug')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
  });

  it('should create a logger with the correct name', () => {
    expect(logger.fields.name).toBe('blockbuster-index-mcp-logger');
  });

  it('should have all required basic methods', () => {
    expect(logger.debug).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  it('should use the correct log level', () => {
    expect(typeof logger.level()).toBe('number');
  });

  it('should log info messages', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    logger.info('test info');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log error messages', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    logger.error('test error');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log warn messages', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    logger.warn('test warn');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should handle object parameters', () => {
    expect(() => logger.info('test', { key: 'value' })).not.toThrow();
    expect(() => logger.error('test', { error: 'message' })).not.toThrow();
  });

  it('should have success method', () => {
    expect(logger.success).toBeDefined();
    expect(typeof logger.success).toBe('function');
  });

  it('should log success messages with SUCCESS prefix', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.success('Operation completed successfully');
    expect(consoleSpy).toHaveBeenCalledWith(
      'SUCCESS: Operation completed successfully',
    );
    consoleSpy.mockRestore();
  });
});
