const path = require('node:path');
const Copy = require('copy-webpack-plugin');
const Css = require('mini-css-extract-plugin');
module.exports = {
  mode: 'production',
  context: __dirname,
  entry: './src/main.ts',
  output: { path: path.join(__dirname, 'dist'), filename: 'shell.js' },
  resolve: {
    extensions: ['.ts', '.js', '.svelte'],
    conditionNames: ['svelte', 'browser', 'import', 'default'],
    mainFields: ['svelte', 'browser', 'module', 'main'],
  },
  module: {
    rules: [
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: { preprocess: require('./svelte.config').preprocess, emitCss: true },
        },
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true, compilerOptions: { noEmit: false } },
        },
      },
      { test: /\.css$/, use: [Css.loader, 'css-loader'] },
    ],
  },
  plugins: [new Css({ filename: 'shell.css' }), new Copy({ patterns: [{ from: 'index.html' }] })],
};
