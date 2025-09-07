const path = require('path');
const webpack = require('webpack');

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
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        devtool: 'nosources-source-map',
        externals: {
            vscode: 'commonjs vscode'
        },
        resolve: {
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: [/node_modules/, /src\/test\/ui/],
                    use: [
                        {
                            loader: 'ts-loader'
                        }
                    ]
                }
            ]
        }
    },
    // Webview bundle
    {
        target: 'web',
        mode: 'production',
        entry: './src/webview/main.ts',
        output: {
            path: path.resolve(__dirname, 'out', 'webview'),
            filename: 'main.js',
            globalObject: 'this'
        },
        devtool: 'nosources-source-map',
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                // Force single Three.js instance to prevent multiple imports
                'three': path.resolve(__dirname, 'node_modules/three'),
            },
            fallback: {
                // Provide browser alternatives for Node.js modules
                "fs": false,
                "path": false,
                "crypto": false
            }
        },
        optimization: {
            // Deduplicate modules to prevent multiple Three.js instances
            splitChunks: false
        },
        plugins: [
            new webpack.DefinePlugin({
                'global': 'globalThis',
                'exports': '({})'
            })
        ],
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: [/node_modules/, /src\/test\/ui/],
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                configFile: 'src/webview/tsconfig.json'
                            }
                        }
                    ]
                }
            ]
        }
    }
]; 