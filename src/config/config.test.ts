describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CONFIG', () => {
    it('should use default values when environment variables are not set', async () => {
      delete process.env.AWS_REGION;
      delete process.env.CACHE_CONTROL;
      delete process.env.CW_LOG_GROUP;
      delete process.env.CW_LOG_STREAM;
      delete process.env.LOG_LEVEL;
      delete process.env.S3_BUCKET_NAME;
      delete process.env.npm_package_version;
      process.env.NODE_ENV = 'development';

      const { CONFIG: freshConfig } = await import('./config');

      expect(freshConfig.AWS_REGION).toBe('us-west-2');
      expect(freshConfig.CACHE_CONTROL).toBe('max-age=300');
      expect(freshConfig.CW_LOG_GROUP).toBe(
        '/aws/ecs/blockbuster-index-mcp-log-group',
      );
      expect(freshConfig.CW_LOG_STREAM).toMatch(/^blockbuster-index-mcp-\d+$/);
      expect(freshConfig.IS_DEVELOPMENT).toBe(true);
      expect(freshConfig.LOG_LEVEL).toBe('info');
      expect(freshConfig.NODE_ENV).toBe('development');
      expect(freshConfig.S3_BUCKET_NAME).toBeUndefined();
      expect(freshConfig.VERSION).toBe('1.0.0');
    });

    it('should use environment variable values when set', async () => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.CACHE_CONTROL = 'no-cache';
      process.env.CW_LOG_GROUP = '/custom/log/group';
      process.env.CW_LOG_STREAM = 'custom-stream';
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      process.env.S3_BUCKET_NAME = 'my-bucket';
      process.env.npm_package_version = '2.0.0';

      const { CONFIG: freshConfig } = await import('./config');

      expect(freshConfig.AWS_REGION).toBe('us-east-1');
      expect(freshConfig.CACHE_CONTROL).toBe('no-cache');
      expect(freshConfig.CW_LOG_GROUP).toBe('/custom/log/group');
      expect(freshConfig.CW_LOG_STREAM).toBe('custom-stream');
      expect(freshConfig.IS_DEVELOPMENT).toBe(false);
      expect(freshConfig.LOG_LEVEL).toBe('debug');
      expect(freshConfig.NODE_ENV).toBe('production');
      expect(freshConfig.S3_BUCKET_NAME).toBe('my-bucket');
      expect(freshConfig.VERSION).toBe('2.0.0');
    });

    it('should handle AWS_TASK_ID in CW_LOG_STREAM', async () => {
      process.env.AWS_TASK_ID = 'task-123';

      const { CONFIG: freshConfig } = await import('./config');

      expect(freshConfig.CW_LOG_STREAM).toBe('blockbuster-index-mcp-task-123');
    });

    it('should default NODE_ENV to development if not set', async () => {
      delete process.env.NODE_ENV;
      const { CONFIG: freshConfig } = await import('./config');
      expect(freshConfig.NODE_ENV).toBe('development');
    });
  });

  describe('validateConfig', () => {
    it('should not throw when all required variables are set', async () => {
      process.env.S3_BUCKET_NAME = 'my-bucket';

      const { validateConfig: freshValidateConfig } = await import('./config');

      expect(() => freshValidateConfig()).not.toThrow();
    });

    it('should throw when S3_BUCKET_NAME is missing', async () => {
      delete process.env.S3_BUCKET_NAME;

      const { validateConfig: freshValidateConfig } = await import('./config');

      expect(() => freshValidateConfig()).toThrow(
        'S3_BUCKET_NAME environment variable is required!',
      );
    });

    it('should throw when S3_BUCKET_NAME is empty', async () => {
      process.env.S3_BUCKET_NAME = '';

      const { validateConfig: freshValidateConfig } = await import('./config');

      expect(() => freshValidateConfig()).toThrow(
        'S3_BUCKET_NAME environment variable is required!',
      );
    });
  });
});
