const path = require('node:path');
const base = require('./webpack.config.js');

module.exports = {
  ...base,
  context: __dirname,
  entry: './src/hosts/localSession.ts',
  output: {
    ...base.output,
    path: path.resolve(__dirname, '../packages/python/ply_visualizer/_assets'),
  },
};
