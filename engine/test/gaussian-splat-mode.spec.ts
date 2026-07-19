import { expect, test } from '@playwright/test';
import * as path from 'path';

// End-to-end splat mode on the standalone page: load a 3DGS PLY, verify the
// DC-color point preview, toggle into Spark splat rendering and back.
test('3DGS file previews with DC colors and toggles into splat mode', async ({ page }) => {
  page.on('pageerror', error => console.error('Page error:', error.message));

  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('#add-file');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/splats/3dgs_small_binary.ply'));

  await expect(page.locator('#file-list')).toContainText('3dgs_small_binary.ply', {
    timeout: 15000,
  });
  await expect(page.locator('#file-list')).toContainText('3DGS');

  // Point preview: colors synthesized from the SH DC coefficients, source
  // bytes retained for splat mode.
  const preview = await page.evaluate(() => {
    const v = (window as any).visualizer;
    const data = v.spatialFiles[0];
    return {
      isSplat: !!data.isGaussianSplat,
      hasColors: !!data.hasColors,
      firstColor: Array.from(data.colorsArray.slice(0, 3)),
      hasSource: !!data.splatSource?.bytes,
    };
  });
  expect(preview).toEqual({
    isSplat: true,
    hasColors: true,
    firstColor: [204, 51, 51],
    hasSource: true,
  });

  // Enter splat mode (first click lazy-loads the ~5 MB Spark chunk).
  const splatBtn = page.locator('.splat-btn[data-file-index="0"]');
  await expect(splatBtn).toBeVisible();
  await splatBtn.click();
  await expect(splatBtn).toHaveClass(/active/, { timeout: 60000 });

  const splatState = await page.evaluate(() => {
    const v = (window as any).visualizer;
    const mesh = v.splatMode.getMesh(0);
    return {
      active: !!v.splatModeActive[0],
      pointsVisible: v.meshes[0].visible,
      splatMeshInScene: !!mesh?.parent,
      splatMeshVisible: !!mesh?.visible,
    };
  });
  expect(splatState).toEqual({
    active: true,
    pointsVisible: false,
    splatMeshInScene: true,
    splatMeshVisible: true,
  });

  // Hidden centers stay pickable: the picker filters on fileVisibility, so
  // the visible-point-cloud list must still contain the hidden mesh.
  const pickable = await page.evaluate(() => {
    const v = (window as any).visualizer;
    return v.fileVisibility[0] !== false && v.meshes[0].geometry.getAttribute('position').count;
  });
  expect(pickable).toBe(2000);

  // Back to points mode: splat mesh disposed, points visible again.
  await splatBtn.click();
  await expect(splatBtn).not.toHaveClass(/active/, { timeout: 15000 });
  const pointsState = await page.evaluate(() => {
    const v = (window as any).visualizer;
    return {
      active: !!v.splatModeActive[0],
      pointsVisible: v.meshes[0].visible,
      splatMesh: v.splatMode.getMesh(0),
    };
  });
  expect(pointsState).toEqual({ active: false, pointsVisible: true, splatMesh: null });
});
