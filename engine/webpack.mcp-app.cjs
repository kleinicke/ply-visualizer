const path = require('node:path');
const fs = require('node:fs');
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
          const depthGlue = fs
            .readFileSync(path.join(__dirname, 'media/wasm/tiff_wasm.js'), 'utf8')
            .replace(
              'document.currentScript !== null',
              'document.currentScript !== null && document.currentScript.src'
            )
            .replace(/<\/script/gi, '<\\/script');
          compilation.emitAsset(
            'tiff_wasm_bg.wasm',
            new webpack.sources.RawSource(
              fs.readFileSync(path.join(__dirname, 'media/wasm/tiff_wasm_bg.wasm'))
            )
          );
          const script = compilation
            .getAsset('app.js')
            .source.source()
            .toString()
            .replace(/<\/script/gi, '<\\/script');
          const resources = Object.fromEntries(
            compilation
              .getAssets()
              .filter(
                a => a.name !== 'app.js' && a.name !== 'app.css' && a.source.size() < 128 * 1024
              )
              .map(a => [a.name, Buffer.from(a.source.source()).toString('base64')])
          );
          const bootstrap = `window.__TIFF_WASM_URL__='/__ply_assets__/tiff_wasm_bg.wasm';window.__PLY_ASSETS__=${JSON.stringify(resources)};`;
          const css =
            fs.readFileSync(path.join(__dirname, 'media/style.css'), 'utf8') +
            compilation
              .getAssets()
              .filter(a => a.name.endsWith('.css'))
              .map(a => a.source.source().toString())
              .join('\n');
          const shell = fs
            .readFileSync(path.join(__dirname, 'index.html'), 'utf8')
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<link\b[^>]*>/gi, '')
            .replace('</head>', () => `<style>${css}</style></head>`)
            .replace(
              '</body>',
              () => `<script>${depthGlue}</script><script>${bootstrap}${script}</script></body>`
            );
          compilation.emitAsset('viewer.html', new webpack.sources.RawSource(shell));
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
    publicPath: '/__ply_assets__/',
    path: path.resolve(__dirname, '../packages/python/viz3d/_mcp_app'),
    clean: true,
  },
  devtool: false,
  module: { rules: [...base.module.rules, { test: /\.wasm$/, type: 'asset/inline' }] },
  plugins: [
    ...require('./agentBuild.cjs'),
    new MiniCssExtractPlugin({ filename: 'app.css', runtime: false }),
    new InlineAppPlugin(),
  ],
};
