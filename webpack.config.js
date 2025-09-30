const path = require('path');

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
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@website': path.resolve(__dirname, 'website/src'),
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
    entry: './website/src/app.ts', // Phase 4: Use Svelte entry point
    output: {
      path: path.resolve(__dirname, 'out', 'webview'),
      filename: 'main.js',
    },
    devtool: 'nosources-source-map',
    resolve: {
      extensions: ['.ts', '.js', '.svelte'],
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
          test: /\.svelte$/,
          use: {
            loader: 'svelte-loader',
            options: {
              emitCss: false,
              hotReload: false,
              compilerOptions: {
                compatibility: {
                  componentApi: 4,
                },
              },
            },
          },
        },
        {
          test: /\.ts$/,
          exclude: [/node_modules/, /src\/test\/ui/, /\.test\.ts$/],
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'website/src/tsconfig.json',
              },
            },
          ],
        },
      ],
    },
  },
];
