const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const path = require('path');
const fs = require('fs');

module.exports = merge(common, {
  mode: 'production',
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    usedExports: true,
    minimize: true,
  },
  parallelism: 1,
  devtool: false,
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: 'public', to: '.', globOptions: { ignore: ['**/index.html'] } }],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new WebpackManifestPlugin({
      fileName: 'manifest.json',
      publicPath: '/',
      seed: {
        'license.txt': path.resolve(__dirname, '/bundle.js.LICENSE.txt'),
      },
      writeToFileEmit: true,
    }),
  ],
});
