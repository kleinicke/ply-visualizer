import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Automatic Eye Dome Lighting', () => {
  const uniformPly = path.resolve('../testfiles/ply/confidence-wave.ply');
  const coloredPly = path.resolve('../testfiles/open3d/sample_pointcloud.ply');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
  });

  test('runs only for visible uniformly coloured point clouds and E cycles all modes', async ({
    page,
  }) => {
    await expect.poll(() => page.evaluate(() => (window as any).visualizer.edlMode)).toBe('auto');

    await page.locator('#hiddenFileInput').setInputFiles(uniformPly);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const pass: any = (window as any).visualizer.edlPass;
          return [pass?.isSelective, pass?.eligibleObjectCount];
        })
      )
      .toEqual([true, 1]);

    // Per-point RGB remains in the full scene/depth render but is deliberately
    // absent from the Auto mask.
    await page.locator('#hiddenFileInput').setInputFiles(coloredPly);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const viewer: any = (window as any).visualizer;
          return [viewer.individualColorModes[1], viewer.edlPass.eligibleObjectCount];
        })
      )
      .toEqual(['original', 1]);

    // With the only uniform cloud hidden, Auto keeps its mask empty and the
    // renderer bypasses the post-processing pass.
    await page.locator('#file-0').uncheck();
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.edlPass.eligibleObjectCount))
      .toBe(0);

    // Selecting a flat palette colour makes the formerly RGB cloud eligible.
    await page.locator('#color-1').selectOption('0');
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.edlPass.eligibleObjectCount))
      .toBe(1);

    await page.locator('#three-canvas').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('e');
    await expect.poll(() => page.evaluate(() => (window as any).visualizer.edlMode)).toBe('all');
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.edlPass.isSelective))
      .toBe(false);

    await page.keyboard.press('e');
    await expect.poll(() => page.evaluate(() => (window as any).visualizer.edlMode)).toBe('off');

    await page.keyboard.press('e');
    await expect.poll(() => page.evaluate(() => (window as any).visualizer.edlMode)).toBe('auto');
  });

  test('renders per-point colours identically in Auto and Off beside a uniform cloud', async ({
    page,
  }) => {
    await page.locator('#hiddenFileInput').setInputFiles([coloredPly, coloredPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    await page.evaluate(() => {
      const viewer: any = (window as any).visualizer;
      viewer.onFileColorModeChange(0, '0');
      viewer.meshes[0].position.x = -2;
      viewer.meshes[1].position.x = 2;
      viewer.meshes[0].updateMatrixWorld(true);
      viewer.meshes[1].updateMatrixWorld(true);
      viewer.fitCameraToAllObjects();
      viewer.requestRender();
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.edlPass.eligibleObjectCount))
      .toBe(1);

    const [coloredClip, uniformClip] = await page.evaluate(() => {
      const viewer: any = (window as any).visualizer;
      const canvas = viewer.renderer.domElement as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      viewer.camera.updateMatrixWorld(true);
      const objectClip = (index: number) => {
        const object = viewer.meshes[index];
        object.geometry.computeBoundingBox();
        object.updateWorldMatrix(true, false);
        const box = object.geometry.boundingBox;
        const xs: number[] = [];
        const ys: number[] = [];
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = box.min.clone().set(x, y, z).applyMatrix4(object.matrixWorld);
              point.project(viewer.camera);
              xs.push(rect.left + ((point.x + 1) / 2) * rect.width);
              ys.push(rect.top + ((1 - point.y) / 2) * rect.height);
            }
          }
        }
        const margin = 4;
        const left = Math.max(rect.left, Math.floor(Math.min(...xs) - margin));
        const top = Math.max(rect.top, Math.floor(Math.min(...ys) - margin));
        const right = Math.min(rect.right, Math.ceil(Math.max(...xs) + margin));
        const bottom = Math.min(rect.bottom, Math.ceil(Math.max(...ys) + margin));
        return { x: left, y: top, width: right - left, height: bottom - top };
      };
      return [objectClip(1), objectClip(0)];
    });
    expect(coloredClip.width).toBeGreaterThan(10);
    expect(coloredClip.height).toBeGreaterThan(10);

    const coloredAutoPixels = await page.screenshot({ clip: coloredClip });
    const uniformAutoPixels = await page.screenshot({ clip: uniformClip });
    await page.evaluate(() => {
      const viewer: any = (window as any).visualizer;
      viewer.toggleEDL(); // Auto -> All
      viewer.toggleEDL(); // All -> Off
    });
    await expect.poll(() => page.evaluate(() => (window as any).visualizer.edlMode)).toBe('off');
    const coloredOffPixels = await page.screenshot({ clip: coloredClip });
    const uniformOffPixels = await page.screenshot({ clip: uniformClip });

    // PNG buffers being byte-identical pins down the actual displayed result,
    // including tone mapping and sRGB conversion—not merely mask membership.
    expect(coloredAutoPixels.equals(coloredOffPixels)).toBe(true);
    expect(uniformAutoPixels.equals(uniformOffPixels)).toBe(false);
  });
});
