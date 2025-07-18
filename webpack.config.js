const webpack = require('webpack');
const path = require('path');
const dotenv = require('dotenv');
const TerserPlugin = require('terser-webpack-plugin');

dotenv.config();

// Determine entry point based on environment variable
const getEntryPoint = () => {
  const signal = process.env.SIGNAL_TYPE;
  console.log('SIGNAL', signal);
  if (signal) {
    return `./src/signals/${signal}/entrypoint.ts`;
  }

  // Default to blockbuster-index
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
      'process.env.SECRET': JSON.stringify(process.env.SECRET),
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
