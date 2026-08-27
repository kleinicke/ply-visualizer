import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE = {
  url: 'https://github.com/kleinicke/ply-visualizer/releases/download/v.1.7.0/test_pc2_binary.ply',
  sourceFileName: 'test_pc2_binary.ply',
  outputFileName: 'test_pc2_binary-v1.7.0.ply',
  byteLength: 3_607_795,
  sha256: '89dff2c037aac59fa57d62e354da1079bd135f6de7dd51c00e9e2b757b656c55',
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, '../dist/examples');
const response = await fetch(EXAMPLE.url);
if (!response.ok) {
  throw new Error(`Failed to download ${EXAMPLE.sourceFileName}: HTTP ${response.status}`);
}

const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (bytes.byteLength !== EXAMPLE.byteLength || sha256 !== EXAMPLE.sha256) {
  throw new Error(
    `Release asset verification failed for ${EXAMPLE.sourceFileName}: ` +
      `${bytes.byteLength} bytes, SHA-256 ${sha256}`
  );
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, EXAMPLE.outputFileName), bytes);
console.log(`Added verified example asset ${EXAMPLE.outputFileName} (${bytes.byteLength} bytes)`);
