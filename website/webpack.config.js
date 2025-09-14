const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // Map webview imports to the actual source files
      '../../src/webview': path.resolve(__dirname, '../src/webview'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    // GeoTIFF will be loaded as external script
    geotiff: 'GeoTIFF',
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'index.html',
          to: 'index.html',
        },
        {
          from: 'media',
          to: 'media',
        },
        {
          from: 'about',
          to: 'about',
        },
        {
          from: 'src/themes',
          to: 'src/themes',
        },
      ],
    }),
  ],
  devtool: 'source-map',
  devServer: {
    static: {
      directory: path.join(__dirname),
    },
    compress: true,
    port: 8080,
    open: true,
  },
};
