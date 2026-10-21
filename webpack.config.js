const path = require('path');
const { readFileSync } = require('node:fs');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const svelteConfig = require('./engine/svelte.config.js');

// CopyPlugin owns these assets. Both bundles refer to the same packaged files;
// the webview's automatic public path starts one directory below out/.
function sharedDecoderAssets(prefix) {
  return {
    oneOf: [
      {
        test: /pointcloud_parser_bg\.wasm$/,
        type: 'asset/resource',
        generator: {
          emit: false,
          filename: `${prefix}wasm/pointcloud-parser/pointcloud_parser_bg.wasm`,
        },
      },
      {
        test: /occt-import-js\.(js|wasm)$/,
        dependency: 'url',
        type: 'asset/resource',
        generator: { emit: false, filename: `${prefix}wasm/cad/[name][ext]` },
      },
    ],
  };
}

module.exports = [
  // Extension source
  {
    target: 'node',
    mode: 'none',
    entry: {
      extension: './src/extension.ts',
      registrationWorker: './src/providerHandlers/registrationWorker.ts',
      parseWorker: './src/providerHandlers/parseWorker.ts',
    },
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: '[name].js',
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
            from: 'node_modules/occt-import-js/dist',
            to: 'wasm/cad',
            globOptions: { ignore: ['**/occt-import-js-worker.js', '**/package.json', '**/*.md'] },
          },
          {
            // Rust/WASM point-cloud parser (nodejs target) — loaded at runtime
            // by the extension host via require(). The .js glue loads the .wasm
            // relative to its own dir, so both must sit together in out/.
            from: 'wasm/pointcloud-parser/pkg',
            to: 'wasm/pointcloud-parser',
            transform(content, absoluteFrom) {
              if (absoluteFrom.endsWith('.wasm')) {
                const webBinary = readFileSync(
                  path.resolve(
                    __dirname,
                    'wasm/pointcloud-parser/pkg-web/pointcloud_parser_bg.wasm'
                  )
                );
                if (!content.equals(webBinary)) {
                  throw new Error(
                    'Node and web point-cloud WASM differ; cannot share the packaged decoder.'
                  );
                }
              }
              return content;
            },
            globOptions: {
              ignore: ['**/package.json', '**/.gitignore', '**/*.d.ts'],
            },
          },
          {
            // The same crate built for `initSync`: the extension host compiles
            // it once and hands the compiled module to every decoder worker
            // (parsePool.ts), so code V8 optimizes in one worker serves them
            // all instead of each fresh worker starting at the baseline tier.
            from: 'wasm/pointcloud-parser/pkg-web',
            to: 'wasm/pointcloud-parser-web',
            globOptions: {
              ignore: ['**/.gitignore', '**/*.d.ts', '**/*.wasm'],
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
        sharedDecoderAssets(''),
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
  {
    name: 'web-extension',
    target: 'webworker',
    mode: 'none',
    entry: './src/web/extension.ts',
    output: {
      path: path.resolve(__dirname, 'out/web'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
    },
    externals: { vscode: 'commonjs vscode' },
    resolve: { extensions: ['.ts', '.js'], mainFields: ['browser', 'module', 'main'] },
    module: { rules: [{ test: /\.ts$/, exclude: /node_modules/, use: 'ts-loader' }] },
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
    // The webview bundle is loaded from local disk by VS Code, not over the
    // network; the default 244KiB web-performance budget does not apply
    performance: { hints: false },
    resolve: {
      extensions: ['.ts', '.js', '.svelte'],
      // Svelte 5 ships its runtime under package.json "svelte"/"browser" export
      // conditions; without these, bundlers resolve the SSR build instead.
      mainFields: ['svelte', 'browser', 'module', 'main'],
      conditionNames: ['svelte', 'browser', 'import', 'default'],
      alias: {
        // Force single Three.js instance to prevent multiple imports. The
        // bare directory alias bypasses three's package "exports" map, so
        // subpath imports like Spark's `three/addons/*` need their own alias
        // (listed first — webpack matches more specific aliases first).
        'three/addons': path.resolve(__dirname, 'node_modules/three/examples/jsm'),
        // Same reason as three/addons: the bare `three` alias below bypasses
        // the exports map, so the WebGPU build needs its own entry. It is only
        // reached through the dynamic import in rendering/rendererBackend.ts,
        // so it lands in a separate chunk rather than the main bundle.
        'three/webgpu': path.resolve(__dirname, 'node_modules/three/build/three.webgpu.js'),
        three: path.resolve(__dirname, 'node_modules/three'),
        // Webview: no Node `require`, so registration loads its wasm in the
        // page (or, where it can, in a worker).
        './wasmLoader$': path.resolve(__dirname, 'engine/src/registration/wasmLoader.browser.ts'),
        '../registration/wasmLoader$': path.resolve(
          __dirname,
          'engine/src/registration/wasmLoader.browser.ts'
        ),
      },
    },
    optimization: {
      // Deduplicate modules to prevent multiple Three.js instances
      splitChunks: false,
    },
    module: {
      parser: {
        javascript: {
          // Workers that must also start inside a VS Code webview are created
          // through utils/webviewWorker.ts; see there. The import path is the
          // one every depth module uses.
          worker: ['...', 'WorkerScript from ../utils/webviewWorker'],
        },
      },
      rules: [
        sharedDecoderAssets('../'),
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
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'bundle.css',
      }),
    ],
  },
];
