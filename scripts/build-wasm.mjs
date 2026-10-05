import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const wasmPack = process.env.WASM_PACK || 'wasm-pack';
for (const [crate, target, outDir] of [
  ['pointcloud-parser', 'nodejs', 'pkg'],
  ['pointcloud-parser', 'web', 'pkg-web'],
  ['tiff-decoder', 'nodejs', 'pkg-nodejs'],
  ['tiff-decoder', 'no-modules', 'pkg-nomodules'],
]) {
  const result = spawnSync(
    wasmPack,
    ['build', '--target', target, '--release', '--out-dir', outDir, '--locked'],
    {
      cwd: `${root}/wasm/${crate}`,
      stdio: 'inherit',
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  rmSync(`${root}/wasm/${crate}/${outDir}/.gitignore`, { force: true });
}
for (const file of ['tiff_wasm.js', 'tiff_wasm_bg.wasm']) {
  copyFileSync(
    `${root}/wasm/tiff-decoder/pkg-nomodules/${file}`,
    `${root}/engine/media/wasm/${file}`
  );
}
// Normalize generated text so the committed outputs pass whitespace checks.
for (const directory of [
  'wasm/pointcloud-parser/pkg',
  'wasm/pointcloud-parser/pkg-web',
  'wasm/tiff-decoder/pkg-nodejs',
  'engine/media/wasm',
]) {
  for (const name of readdirSync(`${root}/${directory}`)) {
    if (/^(pointcloud_parser|tiff_wasm).*\.(js|ts)$/.test(name)) {
      const path = `${root}/${directory}/${name}`;
      writeFileSync(path, readFileSync(path, 'utf8').trimEnd() + '\n');
    }
  }
}
// Record only after every build and copy succeeds.
process.argv.push('--record');
await import('./wasm-artifacts.mjs');
