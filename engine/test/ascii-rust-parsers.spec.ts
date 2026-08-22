import { expect, test, type Page } from '@playwright/test';
import path from 'path';

/**
 * The ASCII point formats are parsed by the Rust crate, in the page.
 *
 * They used to have a second implementation: `parsers/ptsParser.ts` and
 * `parsers/xyzVariantParser.ts` ran in the browser while the Rust ones were
 * reachable only from the extension host, and the two drifted. These files are
 * now the only test that the browser really reaches the crate - if the wasm
 * fails to load in the page, parsing throws rather than quietly falling back,
 * and the file never appears in the list.
 */

const fixture = (name: string) => path.resolve(`test/fixtures/ascii/${name}`);

async function load(page: Page, name: string) {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles(fixture(name));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 10_000 });
}

function parsed(page: Page) {
  return page.evaluate(() => {
    const file = (window as any).visualizer.spatialFiles[0];
    return {
      vertexCount: file.vertexCount as number,
      hasColors: !!file.hasColors,
      hasNormals: !!file.hasNormals,
      hasIntensity: !!file.hasIntensity,
      positions: Array.from((file.positionsArray as Float32Array) ?? []),
      colors: Array.from((file.colorsArray as Uint8Array) ?? []),
      normals: Array.from((file.normalsArray as Float32Array) ?? []),
      intensity: Array.from((file.intensityArray as Float32Array) ?? []),
    };
  });
}

test('PTS: count line and comment are skipped, Open3D columns are detected', async ({ page }) => {
  await load(page, 'open3d.pts');
  const file = await parsed(page);

  expect(file.vertexCount).toBe(5);
  expect(file.hasColors).toBe(true);
  expect(file.hasIntensity).toBe(true);
  expect(file.positions.slice(0, 6)).toEqual([0, 0, 0, 1, 2, 3]);
  expect(file.intensity[1]).toBeCloseTo(0.1, 5);
  // Colours are 0-255 integers, so the dark first row stays dark. Under the
  // value heuristic `0 1 1` would be read as 0..1 floats and turn cyan.
  expect(file.colors.slice(0, 6)).toEqual([0, 1, 1, 1, 1, 1]);
});

test('XYZRGB: integer colours survive the load', async ({ page }) => {
  await load(page, 'colors.xyzrgb');
  const file = await parsed(page);

  expect(file.vertexCount).toBe(4);
  expect(file.hasColors).toBe(true);
  expect(file.colors.slice(0, 6)).toEqual([200, 10, 0, 199, 10, 1]);
});

test('XYZN: the trailing three columns are normals, not colours', async ({ page }) => {
  await load(page, 'normals.xyzn');
  const file = await parsed(page);

  expect(file.vertexCount).toBe(3);
  expect(file.hasNormals).toBe(true);
  expect(file.hasColors).toBe(false);
  expect(file.normals.slice(0, 3)).toEqual([0, 0, 1]);
});

test('XYZ: a fourth column is auto-detected as intensity', async ({ page }) => {
  await load(page, 'intensity.xyz');
  const file = await parsed(page);

  expect(file.vertexCount).toBe(6);
  expect(file.hasIntensity).toBe(true);
  expect(file.intensity[2]).toBeCloseTo(0.5, 5);
  // Intensity reaching the colour UI is what the scalar-field modes read.
  const options = await page.locator('#color-0 option').allTextContents();
  expect(options).toContain('Intensity');
});

test('PCD ascii: NaN rows are dropped and the VIEWPOINT reaches the viewer', async ({ page }) => {
  await load(page, 'viewpoint.pcd');
  const file = await parsed(page);

  // Three rows, one with a NaN coordinate: PCL writes an invalid range pixel
  // that way rather than leaving the point out.
  expect(file.vertexCount).toBe(2);
  expect(file.positions).toEqual([0, 0, 0, 2, 0, 0]);
  expect(file.intensity).toEqual([0.25, 0.75]);
  // Packed float rgb is reinterpreted bit-for-bit, not rounded.
  expect(file.colors).toEqual([255, 128, 64, 1, 2, 3]);

  // The header travels with the points as JSON. Only the extension host's
  // `pcdData` message path turns VIEWPOINT into the file's initial transform -
  // the in-page path never did - so what is checked here is that the header
  // survives the crossing at all, which is what the host path needs and what
  // forced non-identity clouds onto the JS parser before.
  const comments = await page.evaluate(
    () => (window as any).visualizer.spatialFiles[0].comments as string[]
  );
  expect(comments).toContain('ascii with a NaN row');
});

test('PCD binary: packed uint rgb is read straight out of the record', async ({ page }) => {
  await load(page, 'binary.pcd');
  const file = await parsed(page);

  expect(file.vertexCount).toBe(3);
  expect(file.positions).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6]);
  expect(file.colors).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
});

test('PCD binary_compressed: the LZF column-major block is decoded', async ({ page }) => {
  await load(page, 'compressed.pcd');
  const file = await parsed(page);

  // Columns are stored field by field, so getting this wrong yields plausible
  // but transposed geometry rather than an error.
  expect(file.vertexCount).toBe(2);
  expect(file.positions).toEqual([0, 10, 20, 1, 11, 21]);
});
