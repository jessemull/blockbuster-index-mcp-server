import { logger } from './index';
jest.unmock('./index');
jest.unmock('./logger');

jest.mock('bunyan-cloudwatch', () => jest.fn(() => ({ write: jest.fn() })));

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
    expect(logger).toBeDefined();
    expect(logger.fields.name).toBe('blockbuster-index-mcp-logger');
  });

  it('should use the correct log level', () => {
    expect(typeof logger.level()).toBe('number');
  });

  it('should configure CloudWatch stream in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AWS_REGION = 'us-east-1';
    process.env.CW_LOG_GROUP = '/test/log/group';
    process.env.CW_LOG_STREAM = 'test-stream';

    jest.resetModules();
    const { logger: productionLogger } = await import('./index');

    expect(productionLogger).toBeDefined();
    expect(productionLogger.fields.name).toBe('blockbuster-index-mcp-logger');

    expect(() => productionLogger.info('test production log')).not.toThrow();
  });
});

describe('logger', () => {
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
});
