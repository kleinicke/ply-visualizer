import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * NumPy files, read by the Rust reader.
 *
 * `.npy` used to be parsed twice in TypeScript — once as a point cloud, once as
 * a depth image — from a copy-pasted header parser, and `.npz` by a hand-rolled
 * zip walker that could only read *stored* entries. These load real files
 * through the viewer to hold that ground, including the two cases the old
 * readers got wrong: a compressed archive and a one-dimensional shape.
 */

const fixture = (name: string) => path.resolve(`test/fixtures/npy/${name}`);
const shipped = (name: string) => path.resolve(`../testfiles/np/${name}`);

// Two of the checks below fetch a file rather than opening it, to look at the
// decoded array itself; the page can only fetch what the dev server serves.
const served: Array<[string, string]> = [
  ['big_endian_depth.npy', 'npy-big-endian.npy'],
  ['one_dimensional.npy', 'npy-one-dimensional.npy'],
  ['grid_points.npy', 'npy-grid-points.npy'],
];

test.beforeAll(() => {
  for (const [from, to] of served) {
    fs.copyFileSync(fixture(from), path.resolve(`dist/${to}`));
  }
});

// Deliberately not removed afterwards: the suite runs fully parallel, so tests
// from this file land in several workers and each one runs its own `beforeAll`
// and `afterAll` — a worker that finished early would delete the file another
// is still fetching. `dist` is build output and the next build clears it.

async function open(page: Page, file: string) {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles(file);
}

test('an array whose last dimension is 3 is recognised as points and flattened', async ({
  page,
}) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');

  const result = await page.evaluate(async () => {
    const { readNpyWasm, inspectNpyWasm, isNpyPointCloudShape } = (window as any).__plyNpy;
    const bytes = new Uint8Array(await (await fetch('/npy-grid-points.npy')).arrayBuffer());
    const [info] = await inspectNpyWasm(bytes);
    const decoded = await readNpyWasm(bytes);
    return {
      shape: info.shape,
      isPoints: isNpyPointCloudShape(info.shape),
      values: Array.from(decoded.values as Float32Array),
    };
  });

  // A (2,2,3) grid is four XYZ triplets once the leading dimensions collapse,
  // and float64 on disk arrives as f32 like every other dtype.
  expect(result.shape).toEqual([2, 2, 3]);
  expect(result.isPoints).toBe(true);
  expect(result.values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('a compressed NPZ is read; the old zip walker skipped deflated entries', async ({ page }) => {
  await open(page, fixture('compressed_depth.npz'));
  // A depth file needs camera parameters, so the viewer asks for them rather
  // than adding a file — reaching that prompt means the archive decoded.
  await expect(page.locator('#depth-ok')).toBeVisible({ timeout: 15_000 });
});

test('a shipped uncompressed NPZ still reads', async ({ page }) => {
  await open(page, shipped('sample_depth.npz'));
  await expect(page.locator('#depth-ok')).toBeVisible({ timeout: 15_000 });
});

test('a big-endian NPY reads with the declared byte order', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');

  const values = await page.evaluate(async () => {
    const response = await fetch('/npy-big-endian.npy');
    const { readNpyWasm } = (window as any).__plyNpy;
    const array = await readNpyWasm(new Uint8Array(await response.arrayBuffer()));
    return { shape: array.shape, values: Array.from(array.values as Float32Array) };
  });
  expect(values.shape).toEqual([3, 4]);
  // 0, 0.5, 1, … — byte-swapped floats would be astronomically wrong instead.
  expect(values.values.slice(0, 4)).toEqual([0, 0.5, 1, 1.5]);
});

test('a one-dimensional shape parses; the trailing comma used to throw', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');

  const array = await page.evaluate(async () => {
    const response = await fetch('/npy-one-dimensional.npy');
    const { readNpyWasm, inspectNpyWasm } = (window as any).__plyNpy;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const [info] = await inspectNpyWasm(bytes);
    const decoded = await readNpyWasm(bytes);
    return { shape: info.shape, dtype: info.dtype, values: Array.from(decoded.values) };
  });
  expect(array.shape).toEqual([3]);
  expect(array.dtype).toBe('<f4');
  expect(array.values).toEqual([1.5, 2.5, 3.5]);
});
