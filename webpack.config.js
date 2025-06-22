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
                    exclude: /node_modules/,
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
            filename: 'main.js'
        },
        devtool: 'nosources-source-map',
        resolve: {
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
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