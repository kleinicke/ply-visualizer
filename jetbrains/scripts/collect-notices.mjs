// Include dependency license inventories and the license texts distributed with
// the bundled JS/WASM sources. Cargo's resolved closure deliberately includes
// optional/platform packages, so this inventory is conservative.
import { readFile, readdir, mkdir, writeFile, cp, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(repo, 'jetbrains/build/viewer-resources/META-INF/notices');
await mkdir(output, { recursive: true });
await cp(path.join(repo, 'LICENSE'), path.join(output, 'PROJECT-LICENSE.txt'));
const records = new Map();
async function record(id, directory, license, source) {
  if (records.has(id)) return;
  const texts = [];
  for (const file of await readdir(directory)) {
    if (!/^(licen[cs]e|copying|copyright|notice)([.\-_]|$)/i.test(file)) continue;
    try {
      const text = await readFile(path.join(directory, file), 'utf8');
      const target = `${id.replaceAll('/', '__')}--${file}`;
      await writeFile(path.join(output, target), text);
      texts.push(target);
    } catch (error) {
      if (error.code !== 'EISDIR') throw error;
    }
  }
  // Some upstream release packages publish the SPDX declaration only in their
  // package metadata/README. Preserve that original notice instead of inventing
  // copyright holders or silently omitting the component.
  if (!texts.length) {
    for (const file of ['README.md', 'README', 'Cargo.toml', 'package.json']) {
      try {
        const target = `${id.replaceAll('/', '__')}--${file}`;
        await cp(path.join(directory, file), path.join(output, target));
        texts.push(target);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  records.set(id, { id, license, source, texts });
}
async function npmPackage(name, from = repo) {
  let directory;
  for (const parent of [from, repo, path.join(repo, 'engine')]) {
    const candidate = path.join(parent, 'node_modules', name);
    try {
      await access(path.join(candidate, 'package.json'));
      directory = candidate;
      break;
    } catch {}
  }
  if (!directory) throw new Error(`Missing dependency for notices: ${name}`);
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const id = `npm-${pkg.name}@${pkg.version}`;
  if (records.has(id)) return;
  await record(id, directory, pkg.license || pkg.licenses, pkg.repository || pkg.homepage);
  for (const dependency of Object.keys(pkg.dependencies || {}))
    await npmPackage(dependency, directory);
}
for (const name of ['three', 'svelte', '@sparkjsdev/spark', '7z-wasm', 'js-yaml', 'lzma'])
  await npmPackage(name);
for (const manifest of ['wasm/pointcloud-parser/Cargo.toml', 'wasm/tiff-decoder/Cargo.toml']) {
  const result = spawnSync(
    'cargo',
    ['metadata', '--locked', '--offline', '--format-version', '1', '--manifest-path', manifest],
    { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.status !== 0) throw new Error(`Cannot collect Rust licenses: ${result.stderr}`);
  for (const pkg of JSON.parse(result.stdout).packages) {
    await record(
      `cargo-${pkg.name}@${pkg.version}`,
      path.dirname(pkg.manifest_path),
      pkg.license,
      pkg.repository || pkg.homepage
    );
  }
}
await writeFile(
  path.join(output, 'dependencies.json'),
  JSON.stringify([...records.values()], null, 2) + '\n'
);
await cp(path.join(repo, 'jetbrains/notices/upstream'), path.join(output, 'upstream'), {
  recursive: true,
});
await writeFile(
  path.join(output, 'README.txt'),
  `Third-party components\n\nSee dependencies.json for versions, license identifiers and upstream source links.\nAccompanying license/copyright notices are reproduced in this directory.\nThe Rust inventory includes the complete resolved dependency closure.\n\n7z-wasm / 7-Zip: source and build instructions at https://github.com/use-strict/7z-wasm\nIts LGPL-covered WebAssembly module remains a separately bundled asset.\nApplication source: https://github.com/kleinicke/ply-visualizer\n`
);
console.log(`Collected license notices for ${records.size} dependency entries.`);
