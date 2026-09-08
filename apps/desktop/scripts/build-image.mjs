import { withoutUpng } from './image-no-upng.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(
  process.env.IMAGE_ENGINE_SOURCE || path.join(desktop, '../../../tiff-visualizer')
);
const require = createRequire(path.join(source, 'package.json'));
const { build } = require('esbuild');
const output = path.join(desktop, 'vendor/image-engine');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'media'), { recursive: true });
const hook = await readFile(path.join(desktop, 'image-engine/hook.ts'), 'utf8');
const adapt = {
  name: 'desktop-image-boundary',
  setup(api) {
    api.onResolve({ filter: /^upng-js$/ }, () => {
      throw new Error('UPNG must not be included in the desktop artifact');
    });
    api.onResolve({ filter: /^desktop-native-png$/ }, () => ({
      path: path.join(desktop, 'image-engine/native-png.ts'),
    }));
    api.onLoad(
      { filter: /\/(layered-preview-decoders|png-processor|decode-worker)\.ts$/ },
      async args => ({
        contents: withoutUpng(args.path, await readFile(args.path, 'utf8')),
        loader: 'ts',
        resolveDir: path.dirname(args.path),
      })
    );
    api.onLoad({ filter: /media\/imagePreview\.ts$/ }, async args => {
      let contents = await readFile(args.path, 'utf8');
      const marker = '\t// Start the application\n\tinitialize();';
      if (contents.split(marker).length !== 2)
        throw new Error('Image engine initialization boundary changed');
      contents = contents.replace(
        'loadImageByType(src, resourceUri, _loadGeneration, settings.formatHint);',
        'if (src) loadImageByType(src, resourceUri, _loadGeneration, settings.formatHint);'
      );
      contents = contents.replace(marker, `${hook}\n${marker}`);
      return { contents, loader: 'ts', resolveDir: path.dirname(args.path) };
    });
    api.onLoad({ filter: /ui\/image\/mount\.ts$/ }, () => ({
      contents: 'export function mountImageInspector(){ return { message(){} }; }',
      loader: 'ts',
    }));
  },
};
const common = {
  absWorkingDir: source,
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2020',
  logLevel: 'warning',
  format: 'esm',
  conditions: ['browser'],
  nodePaths: [path.join(desktop, '../../node_modules')],
  plugins: [adapt, createRequire(import.meta.url)('../image-engine/svelte-plugin.cjs')()],
};
await build({
  ...common,
  entryPoints: ['media/imagePreview.ts'],
  outdir: path.join(output, 'media'),
  entryNames: 'imagePreview.bundle',
  chunkNames: 'chunks/[name]-[hash]',
  splitting: true,
});
for (const [name, entry, iife] of [
  ['decodeWorker', 'decode-worker'],
  ['pngDecodeWorker', 'png-decode-worker'],
  ['layeredDecodeWorker', 'layered-decode-worker'],
  ['layeredPreviewFallback', 'layered-preview-fallback'],
  ['imagejRoi', 'imagej-roi-entry'],
  ['stripDecodeWorker', 'strip-decode-worker'],
  ['fastRawWorker', 'fast-raw-worker', true],
  ['layerCompositorWorker', 'layer-compositor-worker', true],
])
  await build({
    ...common,
    entryPoints: [`media/${entry}.ts`],
    outfile: path.join(output, `media/${name}.bundle.js`),
    format: iife ? 'iife' : 'esm',
    ...(iife
      ? { supported: { 'import-meta': false }, logOverride: { 'empty-import-meta': 'silent' } }
      : {}),
  });
for (const name of [
  'imagePreview.css',
  'geotiff.min.js',
  'pako.min.js',
  'parse-exr.js',
  'loading.svg',
  'loading-dark.svg',
  'loading-hc.svg',
  'wasm',
])
  await cp(path.join(source, 'media', name), path.join(output, 'media', name), { recursive: true });
await writeFile(
  path.join(output, 'media/imagePreview.bundle.css'),
  '/* The desktop owns all inspector components. */'
);
await writeFile(
  path.join(output, 'vendor-assets.js'),
  (await readFile(path.join(source, 'web/vendor-assets.js'), 'utf8')).replace(
    /^.*(?:upng:|layerDocumentWriter:).*\n/gm,
    ''
  ) +
    '\nwindow.__tiffVisualizerVendorAssets.workers["pngDecodeWorker.bundle.js"] = "./media/pngDecodeWorker.bundle.js";\n(function absoluteAssets(assets) { for (const key of Object.keys(assets)) { if (typeof assets[key] === "string") assets[key] = new URL(assets[key], document.baseURI).href; else if (assets[key] && typeof assets[key] === "object") absoluteAssets(assets[key]); } })(window.__tiffVisualizerVendorAssets);\n'
);
await cp(path.join(desktop, 'image-engine/bootstrap.js'), path.join(output, 'bootstrap.js'));
await cp(path.join(desktop, 'image-engine/surface.css'), path.join(output, 'surface.css'));
await cp(path.join(source, 'LICENSE'), path.join(output, 'LICENSE'));
await cp(path.join(source, 'THIRD_PARTY_NOTICES.md'), path.join(output, 'THIRD_PARTY_NOTICES.md'));
const settings = {
  normalization: { min: 0, max: 1, autoNormalize: true, gammaMode: false },
  gamma: { in: 2.2, out: 2.2 },
  brightness: { offset: 0 },
  nanColor: 'black',
  showScaleBar: false,
  gpuAcceleration: true,
  resourceUri: 'empty.png',
  src: '',
  surfaceMode: 'editor',
  extensionVersion: 'desktop-1',
  vscodeVersion: 'desktop',
};
await writeFile(
  path.join(output, 'index.html'),
  `<!doctype html><html class="vscode-dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta id="image-preview-settings" data-settings='${JSON.stringify(settings)}'><link rel="stylesheet" href="media/imagePreview.css"><link rel="stylesheet" href="media/imagePreview.bundle.css"><link rel="stylesheet" href="surface.css"></head><body class="container image vscode-dark"><div class="loading-indicator"></div><div class="image-load-error"></div><script src="bootstrap.js"></script><script src="vendor-assets.js"></script><script type="module" src="media/imagePreview.bundle.js"></script></body></html>`
);
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
await writeFile(
  path.join(output, 'provenance.json'),
  JSON.stringify(
    {
      repository: 'https://github.com/kleinicke/tiff-visualizer',
      revision,
      version: require('./package.json').version,
      hookSha256: createHash('sha256').update(hook).digest('hex'),
      note: 'Pinned desktop-only build. Rebuild explicitly with scripts/build-image.mjs; upstream UI entry is replaced.',
    },
    null,
    2
  ) + '\n'
);
console.log(`Built pinned image engine ${revision}`);
