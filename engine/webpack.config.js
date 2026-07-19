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
        // 3D Visualizer goes to /3d-visualizer/ path
        {
          from: 'index.html',
          to: '3d-visualizer/index.html',
          transform(content) {
            return (
              content
                .toString()
                // Update paths to be relative from 3d-visualizer subdirectory
                .replace(/src="bundle\.js"/g, 'src="../bundle.js"')
                .replace(/src="media\//g, 'src="../media/')
                .replace(/href="media\//g, 'href="../media/')
                // Worker bootstrap URLs are strings rather than script tags;
                // from /3d-visualizer/ they must also point one level up.
                .replace(
                  /'media\/(geotiff\.min\.js|wasm\/tiff_wasm(?:_bg)?\.(?:js|wasm))'/g,
                  "'../media/$1'"
                )
                // Update navigation: About button goes to root (about page is now at root)
                .replace(
                  /<a href="about\/" class="nav-button">About<\/a>/g,
                  '<a href="../" class="nav-button">About</a>'
                )
                // Impressum and Datenschutz are at root level, need ../ from 3d-visualizer/
                .replace(/href="impressum\.html"/g, 'href="../impressum.html"')
                .replace(/href="datenschutz\.html"/g, 'href="../datenschutz.html"')
            );
          },
        },
        // About page becomes the root index
        {
          from: 'about/index.html',
          to: 'index.html',
          transform(content) {
            return (
              content
                .toString()
                // Update link back to 3D visualizer
                .replace(/href="\.\.\/"/g, 'href="3d-visualizer/"')
            );
          },
        },
        {
          from: 'media',
          to: 'media',
        },
        // Impressum and Datenschutz at root level
        {
          from: 'impressum.html',
          to: 'impressum.html',
        },
        {
          from: 'datenschutz.html',
          to: 'datenschutz.html',
        },
        {
          from: 'src/themes',
          to: 'src/themes',
        },
        // Also copy themes for 3d-visualizer subdirectory (themes are fetched relative to HTML location)
        {
          from: 'src/themes',
          to: '3d-visualizer/src/themes',
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
