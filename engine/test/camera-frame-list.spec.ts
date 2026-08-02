import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Per-camera list under a camera profile entry. Camera profiles, X3A archives
 * and E57 images all build one profile group holding `camera_*` child groups,
 * so this covers the shared listing and look-through path; the JSON profile is
 * the only source small enough to load in a browser test.
 */
test.describe('Individual camera list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/json/camera_profile.json'));
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  });

  test('stays collapsed until opened, then lists every camera', async ({ page }) => {
    const disclosure = page.getByRole('button', { name: /Individual cameras/ });
    await expect(disclosure).toHaveText(/Individual cameras \(19\)/);
    await expect(page.getByRole('button', { name: 'View' })).toHaveCount(0);

    await disclosure.click();
    await expect(page.getByRole('button', { name: 'View' })).toHaveCount(19);
  });

  test('expanding a camera shows its translation', async ({ page }) => {
    await page.getByRole('button', { name: /Individual cameras/ }).click();
    await page.getByRole('button', { name: /l_00/ }).click();

    const details = page.locator('.camera-frame-details').first();
    await expect(details).toContainText('Translation');
    await expect(details).toContainText('Rotation');
  });

  test('View moves the viewer camera onto the camera centre', async ({ page }) => {
    await page.getByRole('button', { name: /Individual cameras/ }).click();

    const expected = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const group = visualizer.cameraGroups[0].children.find((child: any) =>
        child.name.startsWith('camera_')
      );
      group.updateWorldMatrix(true, false);
      const m = group.matrixWorld.elements;
      return [m[12], m[13], m[14]];
    });

    await page.getByRole('button', { name: 'View' }).first().click();

    const actual = await page.evaluate(() => (window as any).visualizer.camera.position.toArray());
    for (let axis = 0; axis < 3; axis++) {
      expect(actual[axis]).toBeCloseTo(expected[axis], 5);
    }
  });

  test('View pivots on the optical centre so rotating keeps the viewpoint', async ({ page }) => {
    await page.getByRole('button', { name: /Individual cameras/ }).click();
    await page.getByRole('button', { name: 'View' }).first().click();

    // The rotation centre sits on the camera itself, not on the image plane
    // metres ahead of it, so orbiting turns the view in place.
    const distance = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      return visualizer.camera.position.distanceTo(visualizer.controls.target);
    });
    expect(distance).toBeLessThan(0.001);

    const eye = () =>
      page.evaluate(() => {
        const camera = (window as any).visualizer.camera;
        return {
          position: camera.position.toArray(),
          direction: camera.getWorldDirection(camera.up.clone().set(0, 0, 0)).toArray(),
        };
      });
    const before = await eye();

    const canvas = (await page.locator('#three-canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 + 120, canvas.y + canvas.height / 2 + 60, {
      steps: 12,
    });
    await page.mouse.up();
    const after = await eye();

    const moved = Math.hypot(
      ...before.position.map((value: number, axis: number) => value - after.position[axis])
    );
    const turned = Math.hypot(
      ...before.direction.map((value: number, axis: number) => value - after.direction[axis])
    );
    expect(moved).toBeLessThan(0.01);
    expect(turned).toBeGreaterThan(0.01);
  });
});

/**
 * Image-plane visibility needs a source that actually embeds imagery; the E57
 * fixture is the smallest one available, so this runs separately from the
 * lightweight camera-profile cases above.
 */
test.describe('Per-camera image visibility', () => {
  test('checkboxes follow the profile-wide image toggle', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/lidar/e57/Station018.e57'));

    const showImages = page.locator('[id^="camera-show-images-"]');
    await expect(showImages).toHaveCount(1, { timeout: 90_000 });

    // Images decode asynchronously; open the list first and wait for the frame
    // to exist so the toggle below acts on a plane that is already in place.
    await page.getByRole('button', { name: /Individual cameras/ }).click();
    const rows = page.locator('.camera-frame-row input[type="checkbox"]');
    await expect(rows).toHaveCount(1, { timeout: 90_000 });
    await expect(rows.first()).not.toBeChecked();

    await showImages.check();
    await expect(rows.first()).toBeChecked();

    // Hiding every plane from the profile toggle must clear the rows too. They
    // used to keep reporting whatever this list had last set itself.
    await showImages.uncheck();
    await expect(rows.first()).not.toBeChecked();

    await showImages.check();
    await expect(rows.first()).toBeChecked();
  });
});
