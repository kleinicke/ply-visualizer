import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Formats with a specified vertical axis (E57, LAS/LAZ, X3A/X3R) open with a
 * Z-up camera; everything else keeps Three.js's Y-up default. The orientation
 * is chosen once, on the first load, so adding a file later never moves the
 * user's view.
 */

const e57 = path.resolve('../testfiles/lidar/e57/pumpAGroupByLineRowColumnIndex.e57');
const x3r = path.resolve('../testfiles/lidar/Abschnitt_A_unpacked/embedded/Stohl_1_A.x3r');
const ply = path.resolve('../testfiles/ply/test_small_mesh.ply');

async function load(page: any, file: string) {
  await page.locator('#hiddenFileInput').setInputFiles(file);
  await page.waitForTimeout(2500);
}
const cam = (page: any) =>
  page.evaluate(() => {
    const c = (window as any).visualizer.camera;
    return { up: c.up.toArray(), pos: c.position.toArray().map((v: number) => +v.toFixed(2)) };
  });

test('Z-up format opened first orients the camera to Z-up', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await load(page, e57);
  console.log('E57_FIRST', JSON.stringify(await cam(page)));
  expect((await cam(page)).up).toEqual([0, 0, 1]);
});

test('Z-up format added second leaves the camera alone', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await load(page, ply);
  const first = await cam(page);
  await load(page, e57);
  const second = await cam(page);
  console.log('PLY_THEN_E57', JSON.stringify({ first, second }));
  expect(second.up).toEqual([0, 1, 0]);
  expect(second.pos).toEqual(first.pos);
});

test('non Z-up format still opens Y-up', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await load(page, ply);
  console.log('PLY_FIRST', JSON.stringify(await cam(page)));
  expect((await cam(page)).up).toEqual([0, 1, 0]);
});

const camState = (page: any) =>
  page.evaluate(() => {
    const v = (window as any).visualizer;
    const c = v.camera;
    const d = c.getWorldDirection(new (c.position.constructor as any)());
    return {
      pos: c.position.toArray().map((x: number) => +x.toFixed(2)),
      up: c.up.toArray().map((x: number) => +x.toFixed(2)),
      dir: d.toArray().map((x: number) => +x.toFixed(2)),
      dirDotUp: +Math.abs(d.dot(c.up)).toFixed(3),
      target: v.controls.target.toArray().map((x: number) => +x.toFixed(2)),
      standoff: c.position.distanceTo(v.controls.target),
    };
  });

test('E57 opens Z-up around its capture point and can rotate', async ({ page }) => {
  test.setTimeout(200000);
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/lidar/e57/pumpAGroupByLineRowColumnIndex.e57'));
  await page.waitForTimeout(3000);
  const start = await camState(page);
  console.log('E57_START', JSON.stringify(start));
  const scanner = await page.evaluate(() => {
    const d = (window as any).visualizer.spatialFiles[0];
    const p = d.metadata?.pose ?? [0, 0, 0, 1, 0, 0, 0];
    const o = d.sourceOrigin ?? [0, 0, 0];
    return [p[0] - o[0], p[1] - o[1], p[2] - o[2]].map(x => +x.toFixed(2));
  });
  // Pivot sits on the capture origin, camera 10 cm behind it.
  expect(start.target).toEqual(scanner);
  expect(start.standoff).toBeCloseTo(0.1, 2);
  expect(start.up).toEqual([0, 0, 1]);
  expect(start.dirDotUp).toBeLessThan(0.1);

  const box = (await page.locator('#three-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60, { steps: 10 });
  await page.mouse.up();
  const after = await camState(page);
  console.log('AFTER_DRAG', JSON.stringify(after));
  expect(after.dir).not.toEqual(start.dir);
});

test('Stonex X3R opens Z-up around its capture point', async ({ page }) => {
  test.setTimeout(200000);
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles(x3r);
  await page.waitForTimeout(3000);

  const start = await camState(page);
  expect(start.target).toEqual([0, 0, 0]);
  expect(start.standoff).toBeCloseTo(0.1, 2);
  expect(start.up).toEqual([0, 0, 1]);
  expect(start.dirDotUp).toBeLessThan(0.1);
});
