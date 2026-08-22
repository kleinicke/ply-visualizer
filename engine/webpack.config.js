const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const svelteConfig = require('./svelte.config.js');

module.exports = {
  mode: 'development',
  // A Three.js + Svelte 3D viewer cannot meet webpack's default 244KiB web
  // budget (bundle is ~1.1MB minified). Keep a real budget so accidental
  // bloat (duplicate Three.js, embedded assets) still warns.
  performance: {
    maxAssetSize: 4 * 1024 * 1024,
    maxEntrypointSize: 4 * 1024 * 1024,
  },
  entry: './src/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.svelte'],
    // Svelte 5 ships its runtime under package.json "svelte"/"browser" export
    // conditions; without these, bundlers resolve the SSR build instead.
    mainFields: ['svelte', 'browser', 'module', 'main'],
    conditionNames: ['svelte', 'browser', 'import', 'default'],
    alias: {
      // Map webview imports to the actual source files
      '../../src/webview': path.resolve(__dirname, '../src/webview'),
      // Standalone page: same as the webview, the in-page loader.
      './wasmLoader$': path.resolve(__dirname, 'src/registration/wasmLoader.browser.ts'),
      '../registration/wasmLoader$': path.resolve(
        __dirname,
        'src/registration/wasmLoader.browser.ts'
      ),
    },
  },
  module: {
    rules: [
      {
        // Matches both `.svelte` components and `.svelte.ts`/`.svelte.js`
        // rune-only state modules (Phase 1's src/state/* stores).
        test: /\.svelte(\.[jt]s)?$/,
        use: {
          loader: 'svelte-loader',
          options: {
            compilerOptions: { dev: false },
            preprocess: svelteConfig.preprocess,
            emitCss: true,
          },
        },
      },
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
          },
        },
        exclude: [/node_modules/, /\.svelte\.ts$/],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.png$/,
        type: 'asset/inline',
      },
      {
        test: /\.svg$/,
        type: 'asset/inline',
      },
    ],
  },
  externals: {
    // GeoTIFF will be loaded as external script
    geotiff: 'GeoTIFF',
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'bundle.css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        // The standalone application is the root of its own deployment.
        {
          from: 'index.html',
          to: 'index.html',
        },
        {
          from: 'media',
          to: 'media',
        },
        {
          from: 'examples',
          to: 'examples',
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
    port: 8081,
    open: true,
  },
};
