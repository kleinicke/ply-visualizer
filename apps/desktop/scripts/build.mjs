import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const webpack = require('webpack');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const desktop = path.join(root, 'apps/desktop');
const engine = require(path.join(root, 'engine/webpack.config.js'));
engine.mode = 'production';
engine.context = path.join(root, 'engine');
engine.entry = ['./src/main.ts', './src/hosts/embeddedViewer.ts'];
engine.output.path = path.join(desktop, 'dist/viewers/3d');
delete engine.devServer;
function build(config) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((error, stats) =>
      compiler.close(() => {
        if (error || stats.hasErrors())
          reject(error || new Error(stats.toString({ all: false, errors: true })));
        else {
          console.log(stats.toString({ all: false, timings: true, warnings: true }));
          resolve();
        }
      })
    );
  });
}
await build(engine);
const index = path.join(engine.output.path, 'index.html');
let html = await readFile(index, 'utf8');
html = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, script =>
    /plausible|analytics\.re4vive/.test(script) ? '' : script
  )
  .replace(/<link\b[^>]*rel="(?:manifest|canonical)"[^>]*>/gi, '')
  .replace(/<div class="bottom-right-nav">[\s\S]*?<\/div>/, '');
await writeFile(index, html);
await mkdir(path.join(desktop, 'dist'), { recursive: true });
await build(require(path.join(desktop, 'webpack.config.js')));
