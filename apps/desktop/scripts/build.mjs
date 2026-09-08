import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const webpack = require('webpack');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const desktop = path.join(root, 'apps/desktop');
const provenance = JSON.parse(
  await readFile(path.join(desktop, 'vendor/image-engine/provenance.json'), 'utf8')
);
const hookHash = createHash('sha256')
  .update(await readFile(path.join(desktop, 'image-engine/hook.ts')))
  .digest('hex');
if (provenance.hookSha256 !== hookHash)
  throw new Error(
    'Image adapter changed. Refresh its pinned artifact with node apps/desktop/scripts/build-image.mjs first.'
  );
const engine = require(path.join(root, 'engine/webpack.config.js'));
engine.mode = 'production';
engine.context = path.join(root, 'engine');
engine.entry = ['./src/main.ts', path.join(desktop, 'src/adapters/scene-entry.ts')];
engine.output.path = path.join(desktop, 'dist/viewers/3d');
delete engine.devServer;
for (const rule of engine.module.rules) {
  if (rule.use?.loader === 'ts-loader') rule.use.options.compilerOptions = { rootDir: root };
}
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
html = html.replace(
  '</head>',
  '<style>#main-ui-panel,#welcome-message,.bottom-right-nav{display:none!important}</style></head>'
);
await writeFile(index, html);
await rm(path.join(desktop, 'dist/viewers/image'), { recursive: true, force: true });
await cp(path.join(desktop, 'vendor/image-engine'), path.join(desktop, 'dist/viewers/image'), {
  recursive: true,
});
await mkdir(path.join(desktop, 'dist'), { recursive: true });
await build(require(path.join(desktop, 'webpack.config.js')));
