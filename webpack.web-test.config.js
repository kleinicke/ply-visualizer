const path = require('path');
module.exports = {
  mode: 'none',
  target: 'webworker',
  entry: './src/web/test/index.ts',
  output: {
    path: path.resolve(__dirname, 'out/web-test'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  externals: { vscode: 'commonjs vscode' },
  resolve: { extensions: ['.ts', '.js'] },
  module: { rules: [{ test: /\.ts$/, exclude: /node_modules/, use: 'ts-loader' }] },
};
