import { expect, test } from '@playwright/test';
import * as fs from 'fs';
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
  const pointsBtn = page.locator('.points-btn[data-file-index="0"]');
  await expect(splatBtn).toBeVisible();
  await expect(pointsBtn).toHaveClass(/active/);
  await expect(page.locator('#max-splat-size-0')).toHaveCount(0);
  await expect(page.locator('#max-splat-size-value-0')).toHaveCount(0);
  await expect(page.locator('#size-0')).toBeVisible();
  await expect(page.locator('#color-0')).toBeVisible();
  await splatBtn.click();
  await expect(splatBtn).toHaveClass(/active/, { timeout: 60000 });
  await expect(pointsBtn).not.toHaveClass(/active/);
  await expect(page.locator('#size-0')).toHaveCount(0);
  await expect(page.locator('#color-0')).toHaveCount(0);

  // The max-size threshold targets oversized background splats rather than
  // making useful interior splats transparent too. Its logarithmic slider
  // exposes small values even when the largest splat is an outlier.
  await expect(page.locator('#max-splat-size-0')).toBeEnabled();
  await expect(page.locator('#max-splat-size-value-0')).toBeEnabled();
  const textureVersionBeforeFilter = await page.evaluate(() => {
    const mesh = (window as any).visualizer.splatMode.getMesh(0);
    return mesh.packedSplats?.source?.version ?? mesh.extSplats?.textures?.[0]?.version ?? 0;
  });
  const largestScaleBefore = await page.evaluate(() => {
    const mesh = (window as any).visualizer.splatMode.getMesh(0);
    let largest = 0;
    mesh.forEachSplat((_index: number, _center: any, scales: any) => {
      largest = Math.max(largest, Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
    });
    return largest;
  });
  const splatSizeRange = await page.evaluate(() =>
    (window as any).visualizer.splatMode.getMaxSplatSizeRange(0)
  );
  expect(splatSizeRange.min).toBe(0.01);
  expect(splatSizeRange.max).toBeCloseTo(largestScaleBefore, 5);
  const logarithmicMidpoint = Math.sqrt(splatSizeRange.min * splatSizeRange.max);
  await page.locator('#max-splat-size-0').fill('50');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mesh = (window as any).visualizer.splatMode.getMesh(0);
        let largest = 0;
        mesh.forEachSplat((_index: number, _center: any, scales: any) => {
          largest = Math.max(largest, Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
        });
        return largest;
      })
    )
    .toBeLessThan(logarithmicMidpoint * 1.1);
  const largestScaleAfter = await page.evaluate(() => {
    const mesh = (window as any).visualizer.splatMode.getMesh(0);
    let largest = 0;
    mesh.forEachSplat((_index: number, _center: any, scales: any) => {
      largest = Math.max(largest, Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
    });
    return largest;
  });
  expect(largestScaleAfter).toBeLessThan(logarithmicMidpoint * 1.1);
  expect(largestScaleAfter).toBeGreaterThan(logarithmicMidpoint * 0.9);
  expect(parseFloat(await page.locator('#max-splat-size-value-0').inputValue())).toBeCloseTo(
    logarithmicMidpoint,
    4
  );
  expect(
    await page.evaluate(() => {
      const mesh = (window as any).visualizer.splatMode.getMesh(0);
      let hidden = 0;
      mesh.forEachSplat(
        (_index: number, _center: any, _scales: any, _quaternion: any, opacity: number) => {
          if (opacity === 0) {hidden++;}
        }
      );
      return hidden;
    })
  ).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mesh = (window as any).visualizer.splatMode.getMesh(0);
        return mesh.packedSplats?.source?.version ?? mesh.extSplats?.textures?.[0]?.version ?? 0;
      })
    )
    .toBeGreaterThan(textureVersionBeforeFilter);

  // The text field accepts an exact scene-unit cap, and double-clicking the
  // logarithmic slider restores the original uncapped maximum.
  const exactThreshold = logarithmicMidpoint * 0.75;
  await page.locator('#max-splat-size-value-0').fill(String(exactThreshold));
  await page.locator('#max-splat-size-value-0').press('Enter');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mesh = (window as any).visualizer.splatMode.getMesh(0);
        let largest = 0;
        mesh.forEachSplat((_index: number, _center: any, scales: any) => {
          largest = Math.max(largest, Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
        });
        return largest;
      })
    )
    .toBeLessThan(exactThreshold * 1.1);
  await page.locator('#max-splat-size-0').dblclick();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mesh = (window as any).visualizer.splatMode.getMesh(0);
        let largest = 0;
        mesh.forEachSplat((_index: number, _center: any, scales: any) => {
          largest = Math.max(largest, Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
        });
        return largest;
      })
    )
    .toBeGreaterThan(splatSizeRange.max * 0.99);
  await expect(page.locator('#max-splat-size-0')).toHaveValue('100');

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

  // Rotation-center picking uses Spark's ellipsoid raycaster, with the old
  // center-point scan retained only as a fallback.
  const directPickInfo = await page.evaluate(() => {
    const v = (window as any).visualizer;
    const mesh = v.splatMode.getMesh(0);
    mesh.updateMatrixWorld(true);
    let target: any = null;
    mesh.forEachSplat((_index: number, center: any) => {
      target ??= center.clone().applyMatrix4(mesh.matrixWorld);
    });
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    const screen = target.project(v.camera);
    const x = (screen.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (screen.y * -0.5 + 0.5) * canvas.clientHeight;
    v.selectionManager.updateContext(v.getSelectionContext());
    return v.selectionManager.selectPointWithLogging(x, y, canvas)?.info ?? null;
  });
  expect(directPickInfo).toContain('gaussian splat surface');

  // Spark requests frames only while its async sort/update is dirty.
  await page.waitForTimeout(1200);
  const idleSplatFrame = await page.evaluate(
    () => (window as any).visualizer.renderer.info.render.frame
  );
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).visualizer.renderer.info.render.frame)).toBe(
    idleSplatFrame
  );

  // Hidden centers stay pickable: the picker filters on fileVisibility, so
  // the visible-point-cloud list must still contain the hidden mesh.
  const pickable = await page.evaluate(() => {
    const v = (window as any).visualizer;
    return v.fileVisibility[0] !== false && v.meshes[0].geometry.getAttribute('position').count;
  });
  expect(pickable).toBe(2000);

  // Back to points mode: splat mesh disposed, points visible again.
  const frameBeforeSwitch = await page.evaluate(
    () => (window as any).visualizer.renderer.info.render.frame
  );
  await pointsBtn.click();
  await expect(splatBtn).not.toHaveClass(/active/, { timeout: 15000 });
  await expect(pointsBtn).toHaveClass(/active/);
  await expect(page.locator('#size-0')).toBeEnabled();
  await expect(page.locator('#color-0')).toBeEnabled();
  await expect(page.locator('#max-splat-size-0')).toHaveCount(0);
  await expect(page.locator('#max-splat-size-value-0')).toHaveCount(0);

  // Point size follows the same extension-wide slider convention.
  await page.locator('#size-0').fill('0.01');
  await page.locator('#size-0').dblclick();
  await expect(page.locator('#size-0')).toHaveValue('0.001');
  expect(await page.evaluate(() => (window as any).visualizer.pointSizes[0])).toBeCloseTo(0.001);
  const pointsState = await page.evaluate(() => {
    const v = (window as any).visualizer;
    return {
      active: !!v.splatModeActive[0],
      pointsVisible: v.meshes[0].visible,
      splatMesh: v.splatMode.getMesh(0),
    };
  });
  expect(pointsState).toEqual({ active: false, pointsVisible: true, splatMesh: null });

  // Mode changes invalidate one frame immediately, then the demand-driven
  // renderer returns to idle rather than running continuously.
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.renderer.info.render.frame))
    .toBeGreaterThan(frameBeforeSwitch);
  await page.waitForTimeout(200);
  const frameAfterSwitch = await page.evaluate(
    () => (window as any).visualizer.renderer.info.render.frame
  );
  await page.waitForTimeout(500);
  const frameAfterIdle = await page.evaluate(
    () => (window as any).visualizer.renderer.info.render.frame
  );
  expect(frameAfterIdle).toBe(frameAfterSwitch);
});

// Splat-native container (.splat): decoded by Spark, centers extracted for
// picking/points mode, splat rendering enabled automatically on load.
test('.splat container loads with splat mode on by default', async ({ page }) => {
  page.on('pageerror', error => console.error('Page error:', error.message));

  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('#add-file');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/splats/3dgs_test.splat'));

  await expect(page.locator('#file-list')).toContainText('3dgs_test.splat', { timeout: 60000 });
  await expect(page.locator('#file-list')).toContainText('3DGS');

  // Splat mode turns on automatically for container formats.
  const splatBtn = page.locator('.splat-btn[data-file-index="0"]');
  const pointsBtn = page.locator('.points-btn[data-file-index="0"]');
  await expect(splatBtn).toHaveClass(/active/, { timeout: 60000 });
  await expect(pointsBtn).not.toHaveClass(/active/);

  const state = await page.evaluate(() => {
    const v = (window as any).visualizer;
    const data = v.spatialFiles[0];
    return {
      active: !!v.splatModeActive[0],
      pointsVisible: v.meshes[0].visible,
      splatMeshInScene: !!v.splatMode.getMesh(0)?.parent,
      vertexCount: data.vertexCount,
      isSplat: !!data.isGaussianSplat,
      firstColor: Array.from(data.colorsArray.slice(0, 3)),
      opacityField: !!data.scalarFields?.opacity,
      hasSourceBytes: !!data.splatSource?.bytes,
    };
  });
  expect(state.active).toBe(true);
  expect(state.pointsVisible).toBe(false);
  expect(state.splatMeshInScene).toBe(true);
  expect(state.vertexCount).toBe(200);
  expect(state.isSplat).toBe(true);
  expect(state.opacityField).toBe(true);
  expect(state.hasSourceBytes).toBe(true);
  // First anchor gaussian is (0.8, 0.2, 0.2) — allow small color-space wiggle.
  const [r, g, b] = state.firstColor as number[];
  expect(Math.abs(r - 204)).toBeLessThanOrEqual(8);
  expect(Math.abs(g - 51)).toBeLessThanOrEqual(8);
  expect(Math.abs(b - 51)).toBeLessThanOrEqual(8);

  // Toggle to points mode works for containers too.
  await pointsBtn.click();
  await expect(splatBtn).not.toHaveClass(/active/, { timeout: 15000 });
  const pointsVisible = await page.evaluate(() => (window as any).visualizer.meshes[0].visible);
  expect(pointsVisible).toBe(true);
});

test('removing a file during splat decode does not attach a ghost mesh', async ({ page }) => {
  const source = fs.readFileSync(path.resolve('../testfiles/splats/3dgs_small_binary.ply'));
  await page.route('**/delayed-3dgs.ply', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 200, body: source });
  });

  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'remove-during-load.ply',
    mimeType: 'application/octet-stream',
    buffer: source,
  });
  await expect(page.locator('#file-list')).toContainText('remove-during-load.ply');
  await page.evaluate(() => {
    (window as any).visualizer.spatialFiles[0].splatSource = { url: '/delayed-3dgs.ply' };
  });

  await page.locator('.splat-btn[data-file-index="0"]').click();
  await page.waitForTimeout(100);
  await page.locator('.remove-file[data-file-index="0"]').click();
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => {
    const v = (window as any).visualizer;
    return {
      fileCount: v.spatialFiles.length,
      activeCount: v.splatModeActive.filter(Boolean).length,
      splatMeshesInScene: v.scene.children.filter(
        (child: any) => child.constructor?.name === 'SplatMesh'
      ).length,
    };
  });
  expect(state).toEqual({ fileCount: 0, activeCount: 0, splatMeshesInScene: 0 });
});
