import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The depth cache (`fileDepthData`) is keyed by file index, and the index a
 * depth file ends up with is only known once addNewFiles() has pushed it.
 * Loading anything while the camera-parameter dialog is open moves the depth
 * file down the list, so a key guessed before the dialog files the cache under
 * a different file - and "Apply settings" then fails with "No cached depth data
 * found for this file".
 */
test('a cloud loaded while the depth dialog is open does not steal the depth cache', async ({
  page,
}) => {
  test.slow();
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);

  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);

  await page.locator('#hiddenFileInput').setInputFiles(path.resolve('../testfiles/tif/depth.tif'));
  await expect(page.locator('#depth-fx')).toBeVisible();

  // Another cloud arrives while the dialog still waits for camera parameters.
  await page.evaluate(async () => {
    const response = await fetch('examples/example-point-cloud.ply');
    const file = new File([await response.arrayBuffer()], 'second.ply');
    await (window as any).visualizer.handleBrowserFiles([file]);
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(2);

  await page.locator('#depth-fx').fill('1000');
  await page.locator('#depth-ok').click();
  await expect(page.locator('#file-list .file-item')).toHaveCount(3);
  await page.waitForTimeout(1500);

  // The cache must sit on the index the depth file actually got.
  const depthIndex = await page.evaluate(
    () =>
      (window as any).visualizer.spatialFiles.findIndex((f: any) =>
        /\.tif$/i.test(f.fileName)
      ) as number
  );
  expect(depthIndex).toBe(2);
  expect(
    await page.evaluate(
      index => (window as any).visualizer.fileDepthData.get(index)?.fileName,
      depthIndex
    )
  ).toBe('depth.tif');

  // ...and reprojecting from the panel works instead of erroring.
  const first = () =>
    page.evaluate(
      index =>
        Array.from(
          (window as any).visualizer.meshes[index].geometry
            .getAttribute('position')
            .array.slice(0, 3) as Float32Array
        ),
      depthIndex
    );
  const before = await first();
  if (!(await page.locator(`#depth-panel-${depthIndex}`).isVisible())) {
    // Only the depth file has a settings toggle, whatever its index.
    await page.locator('.depth-settings-toggle').first().click();
  }
  await expect(page.locator(`#depth-panel-${depthIndex}`)).toBeVisible();
  await page.locator(`#fx-${depthIndex}`).fill('400');
  // Live update is on for depth files, so committing the field runs exactly the
  // reprojection path that reported the missing cache.
  await page.locator(`#fx-${depthIndex}`).press('Enter');

  await expect.poll(async () => (await first())[0], { timeout: 30_000 }).not.toBe(before[0]);
  await expect(page.locator('#error-message')).not.toContainText('No cached depth data');
});
