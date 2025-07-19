const webpack = require('webpack');
const path = require('path');
const dotenv = require('dotenv');
const TerserPlugin = require('terser-webpack-plugin');

dotenv.config();

// Determine entry point based on environment variable...

const getEntryPoint = () => {
  const signal = process.env.SIGNAL_TYPE;
  console.log('SIGNAL', signal);
  if (signal) {
    return `./src/signals/${signal}/entrypoint.ts`;
  }

  // Default to blockbuster-index...

  return './src/signals/blockbuster-index/entrypoint.ts';
};

module.exports = {
  entry: getEntryPoint(),
  devtool: false,
  target: 'node',
  output: {
    filename: 'index.js',
    libraryTarget: 'commonjs2',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: {
    assert: 'commonjs assert',
    buffer: 'commonjs buffer',
    crypto: 'commonjs crypto',
    events: 'commonjs events',
    fs: 'commonjs fs',
    http: 'commonjs http',
    https: 'commonjs https',
    module: 'commonjs module',
    os: 'commonjs os',
    path: 'commonjs path',
    stream: 'commonjs stream',
    url: 'commonjs url',
    util: 'commonjs util',
    vm: 'commonjs vm',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  mode: 'none',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        exclude: /index\.ts$/,
        terserOptions: {
          compress: {
            drop_console: true,
          },
          output: {
            comments: false,
          },
        },
      }),
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.AMAZON_DYNAMODB_TABLE_NAME': JSON.stringify(
        process.env.AMAZON_DYNAMODB_TABLE_NAME,
      ),
      'process.env.AMAZON_SLIDING_WINDOW_TABLE_NAME': JSON.stringify(
        process.env.AMAZON_SLIDING_WINDOW_TABLE_NAME,
      ),
      'process.env.AWS_REGION': JSON.stringify(process.env.AWS_REGION),
      'process.env.AWS_TASK_ID': JSON.stringify(process.env.AWS_TASK_ID),
      'process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME': JSON.stringify(
        process.env.BLOCKBUSTER_INDEX_DYNAMODB_TABLE_NAME,
      ),
      'process.env.BROADBAND_DYNAMODB_TABLE_NAME': JSON.stringify(
        process.env.BROADBAND_DYNAMODB_TABLE_NAME,
      ),
      'process.env.BROADBAND_S3_BUCKET': JSON.stringify(
        process.env.BROADBAND_S3_BUCKET,
      ),
      'process.env.CACHE_CONTROL': JSON.stringify(process.env.CACHE_CONTROL),
      'process.env.CENSUS_DYNAMODB_TABLE_NAME': JSON.stringify(
        process.env.CENSUS_DYNAMODB_TABLE_NAME,
      ),
      'process.env.CW_LOG_GROUP': JSON.stringify(process.env.CW_LOG_GROUP),
      'process.env.CW_LOG_STREAM': JSON.stringify(process.env.CW_LOG_STREAM),
      'process.env.FORCE_REFRESH': JSON.stringify(process.env.FORCE_REFRESH),
      'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL),
      'process.env.MAX_RETRIES': JSON.stringify(process.env.MAX_RETRIES),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.PUPPETEER_EXECUTABLE_PATH': JSON.stringify(
        process.env.PUPPETEER_EXECUTABLE_PATH,
      ),
      'process.env.RETRY_DELAY': JSON.stringify(process.env.RETRY_DELAY),
      'process.env.S3_BUCKET_NAME': JSON.stringify(process.env.S3_BUCKET_NAME),
      'process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME': JSON.stringify(
        process.env.SIGNAL_SCORES_DYNAMODB_TABLE_NAME,
      ),
      'process.env.SIGNAL_TYPE': JSON.stringify(process.env.SIGNAL_TYPE),
      'process.env.npm_package_version': JSON.stringify(
        process.env.npm_package_version,
      ),
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^dtrace-provider$/,
    }),
  ],
  ignoreWarnings: [
    /Critical dependency: the request of a dependency is an expression/,
    /Module not found: Error: Can't resolve 'bufferutil'/,
    /Module not found: Error: Can't resolve 'utf-8-validate'/,
  ],
};
