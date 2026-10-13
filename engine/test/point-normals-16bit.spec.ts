import { test, expect } from '@playwright/test';

/**
 * A point cloud's normals are stored as snorm16 (utils/normals.ts): half the
 * memory of floats, never more than 1/65534 off per component. Everything
 * that reads them back - the normals view and PLY export - must see the same
 * unit vectors the file had.
 */
function unitNormals(count: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const theta = (i * 2.399963) % (2 * Math.PI);
    const z = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - z * z);
    out.push([r * Math.cos(theta), r * Math.sin(theta), z]);
  }
  return out;
}

function plyWithNormals(normals: number[][], scale = 1): Buffer {
  const rows = normals.map(
    ([nx, ny, nz], i) =>
      `${i % 40} ${Math.floor(i / 40)} 0 ${nx * scale} ${ny * scale} ${nz * scale}`
  );
  return Buffer.from(
    'ply\nformat ascii 1.0\n' +
      `element vertex ${rows.length}\n` +
      'property float x\nproperty float y\nproperty float z\n' +
      'property float nx\nproperty float ny\nproperty float nz\nend_header\n' +
      rows.join('\n') +
      '\n'
  );
}

async function load(page: any, buffer: Buffer) {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles({ name: 'normals.ply', mimeType: 'text/plain', buffer });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 15_000 });
}

test('unit normals are kept as snorm16 and read back as the same vectors', async ({ page }) => {
  const normals = unitNormals(1000);
  await load(page, plyWithNormals(normals));
  const read = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const data = viewer.spatialFiles[0];
    // The normals view: segment ends minus starts, over its 0.1 length.
    const lines = viewer.createNormalsVisualizer(data);
    const segments = lines.geometry.getAttribute('position').array as Float32Array;
    const viewed: number[] = [];
    for (let i = 0; i < segments.length; i += 6) {
      for (let k = 0; k < 3; k++) {
        viewed.push((segments[i + 3 + k] - segments[i + k]) / 0.1);
      }
    }
    lines.geometry.dispose();
    // PLY export writes nx ny nz after x y z.
    const exported = (viewer.generatePlyFileContent(data, 0) as string)
      .split('end_header\n')[1]
      .trim()
      .split('\n')
      .flatMap(line => line.split(' ').slice(3, 6).map(Number));
    return {
      type: data.normalsArray.constructor.name,
      bytes: data.normalsArray.byteLength,
      viewed,
      exported,
    };
  });
  expect(read.type).toBe('Int16Array');
  expect(read.bytes).toBe(1000 * 3 * 2);
  const expected = normals.flat();
  const worst = (values: number[]) =>
    values.reduce((max, value, i) => Math.max(max, Math.abs(value - expected[i])), 0);
  // Half a step of 1/32767, plus float32 rounding of the source values.
  expect(worst(read.exported)).toBeLessThan(2e-5);
  expect(worst(read.viewed)).toBeLessThan(1e-4);
});

test('normals that are not unit length are kept exactly as floats', async ({ page }) => {
  await load(page, plyWithNormals(unitNormals(10), 3));
  const type = await page.evaluate(
    () => (window as any).visualizer.spatialFiles[0].normalsArray.constructor.name
  );
  expect(type).toBe('Float32Array');
});
