const path = require('node:path');
const base = require('./webpack.config.js');

module.exports = {
  ...base,
  context: __dirname,
  plugins: [...base.plugins, ...require('./agentBuild.cjs')],
  entry: './src/hosts/localSession.ts',
  output: {
    ...base.output,
    path: path.resolve(__dirname, '../packages/python/viz3d/_assets'),
  },
};
