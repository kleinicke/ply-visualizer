const path = require('node:path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const base = require('./webpack.config.js');

// MCP resources contain their own UI script/styles; no CDN or local fetch needed.
class InlineAppPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('InlineApp', compilation => {
      compilation.hooks.processAssets.tap(
        { name: 'InlineApp', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
        () => {
          const script = compilation
            .getAsset('app.js')
            .source.source()
            .toString()
            .replace(/<\/script/gi, '<\\/script');
          const css = compilation.getAsset('app.css')?.source.source().toString() || '';
          compilation.emitAsset(
            'viewer.html',
            new webpack.sources.RawSource(
              `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><script>${script}</script></body></html>`
            )
          );
        }
      );
    });
  }
}
module.exports = {
  ...base,
  context: __dirname,
  entry: './src/hosts/mcpApp.ts',
  output: {
    filename: 'app.js',
    publicPath: '',
    path: path.resolve(__dirname, '../packages/python/ply_visualizer/_mcp_app'),
    clean: true,
  },
  devtool: false,
  plugins: [
    new MiniCssExtractPlugin({ filename: 'app.css' }),
    new InlineAppPlugin(),
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
};
