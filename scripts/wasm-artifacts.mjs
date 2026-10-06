import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = resolve(root, 'wasm/artifacts.json');
function collect(directory, accept) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory())
      return ['target', '.git', 'pkg', 'pkg-web', 'pkg-nodejs', 'pkg-nomodules'].includes(
        entry.name
      )
        ? []
        : collect(path, accept);
    return accept(path) ? [path] : [];
  });
}
function digest(paths) {
  return Object.fromEntries(
    paths.sort().map(path => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(root, path)))
        .digest('hex'),
    ])
  );
}
const sources = [
  ...collect('wasm', path => /\.(rs|toml|lock)$/.test(path)),
  ...collect('crates/image-decoders', path => /\.(rs|toml|lock)$/.test(path)),
  ...collect('crates/jpegxr', path => /\.(rs|toml|lock)$/.test(path)),
  'scripts/build-wasm.mjs',
];
const outputs = [
  'wasm/pointcloud-parser/pkg',
  'wasm/pointcloud-parser/pkg-web',
  'wasm/tiff-decoder/pkg-nodejs',
  'engine/media/wasm',
].flatMap(directory =>
  readdirSync(resolve(root, directory))
    .filter(name => /^(pointcloud_parser|tiff_wasm).*\.(wasm|js|ts)$/.test(name))
    .map(name => `${directory}/${name}`)
);
const actual = { sources: digest(sources), outputs: digest(outputs) };
if (process.argv.includes('--record')) {
  writeFileSync(manifest, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Recorded ${outputs.length} WASM build artifacts.`);
} else {
  const expected = JSON.parse(readFileSync(manifest, 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const changed = ['sources', 'outputs'].flatMap(group =>
      [...new Set([...Object.keys(actual[group]), ...Object.keys(expected[group])])].filter(
        path => actual[group][path] !== expected[group][path]
      )
    );
    throw new Error(
      `WASM sources/artifacts changed: ${changed.join(', ')}. Run npm run build:wasm and commit its outputs and ${relative(root, manifest)}.`
    );
  }
  console.log('WASM sources and artifacts match the recorded build.');
}
