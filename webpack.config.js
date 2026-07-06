const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const svelteConfig = require('./engine/svelte.config.js');

module.exports = [
  // Extension source
  {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
      devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    devtool: 'nosources-source-map',
    externals: {
      vscode: 'commonjs vscode',
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'node_modules/7zip-bin/**/*',
            to: '7zip-bin/',
            globOptions: {
              ignore: ['**/package.json', '**/README.md'],
            },
          },
          {
            // Rust/WASM point-cloud parser (nodejs target) — loaded at runtime
            // by the extension host via require(). The .js glue loads the .wasm
            // relative to its own dir, so both must sit together in out/.
            from: 'wasm/pointcloud-parser/pkg',
            to: 'wasm/pointcloud-parser',
            globOptions: {
              ignore: ['**/package.json', '**/.gitignore', '**/*.d.ts'],
            },
          },
        ],
      }),
    ],
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@engine': path.resolve(__dirname, 'engine/src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: [/node_modules/, /src\/test\/ui/],
          use: [
            {
              loader: 'ts-loader',
            },
          ],
        },
      ],
    },
  },
  // Webview bundle
  {
    target: 'web',
    mode: 'production',
    entry: './engine/src/main.ts',
    output: {
      path: path.resolve(__dirname, 'out', 'webview'),
      filename: 'main.js',
    },
    devtool: 'nosources-source-map',
    resolve: {
      extensions: ['.ts', '.js', '.svelte'],
      // Svelte 5 ships its runtime under package.json "svelte"/"browser" export
      // conditions; without these, bundlers resolve the SSR build instead.
      mainFields: ['svelte', 'browser', 'module', 'main'],
      conditionNames: ['svelte', 'browser', 'import', 'default'],
      alias: {
        // Force single Three.js instance to prevent multiple imports
        three: path.resolve(__dirname, 'node_modules/three'),
      },
    },
    optimization: {
      // Deduplicate modules to prevent multiple Three.js instances
      splitChunks: false,
    },
    module: {
      rules: [
        {
          // Matches both `.svelte` components and `.svelte.ts`/`.svelte.js`
          // rune-only state modules (Phase 1's engine/src/state/* stores).
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
          exclude: [/node_modules/, /src\/test\/ui/, /\.svelte\.ts$/],
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'engine/src/tsconfig.json',
                compiler: path.resolve(__dirname, 'engine/node_modules/typescript'),
                // The engine tsconfig sets noEmit for standalone typechecking;
                // ts-loader needs emitted JS to bundle
                compilerOptions: { noEmit: false },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'bundle.css',
      }),
    ],
  },
];
