const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // Map webview imports to the actual source files
      '../../src/webview': path.resolve(__dirname, '../src/webview'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    // GeoTIFF will be loaded as external script
    geotiff: 'GeoTIFF',
  },
  plugins: [
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
                // Update navigation: About button goes to root (about page is now at root)
                .replace(
                  /<a href="about\/" class="nav-button">About<\/a>/g,
                  '<a href="../" class="nav-button">About</a>'
                )
                // Other about/ links go to ../about/ (impressum, etc.)
                .replace(/href="about\//g, 'href="../about/')
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
                // Update footer links to point to about subdirectory
                .replace(/href="impressum\.html"/g, 'href="about/impressum.html"')
                .replace(/href="datenschutz\.html"/g, 'href="about/datenschutz.html"')
            );
          },
        },
        {
          from: 'media',
          to: 'media',
        },
        // Keep about subpages (impressum, datenschutz) in about/
        {
          from: 'about',
          to: 'about',
          globOptions: {
            ignore: ['**/index.html'], // Don't copy index.html, it goes to root
          },
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
