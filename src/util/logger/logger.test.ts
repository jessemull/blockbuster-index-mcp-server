import * as bunyan from 'bunyan';
import BunyanCloudWatch from 'bunyan-cloudwatch';
import { logger } from './index';

jest.mock('bunyan-cloudwatch', () => jest.fn(() => ({ write: jest.fn() })));

describe('Logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should create a logger with the correct name', () => {
    expect(logger.fields.name).toBe('blockbuster-index-mcp-logger');
  });

  it('should use the correct log level', () => {
    expect(logger.level()).toBe(bunyan.INFO);
  });

  it('should configure a CloudWatch stream with the correct parameters', () => {
    expect(BunyanCloudWatch).toHaveBeenCalledWith(
      expect.objectContaining({
        logGroupName: '/aws/ecs/blockbuster-index-mcp-log-group',
        awsRegion: 'us-west-2',
      }),
    );
  });
});
