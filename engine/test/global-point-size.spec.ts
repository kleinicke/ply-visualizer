import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * One size for every cloud, at the foot of the file list.
 *
 * It is absolute rather than a multiplier, so the per-file sliders keep showing
 * the size actually drawn — and it stays inactive while the clouds disagree,
 * because an active control claiming one number over a scene holding several
 * would be lying, and nudging it would silently flatten sizes someone set on
 * purpose.
 */
test.describe('All point sizes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  });

  const sizes = (page: any) =>
    page.evaluate(() => (window as any).visualizer.pointSizes.slice(0, 2) as number[]);

  test('sets every cloud at once, and accepts a size beyond the slider range', async ({ page }) => {
    const slider = page.locator('#all-point-sizes-slider');
    await expect(slider).toBeVisible();

    await slider.fill('0.0123');
    await slider.dispatchEvent('input');
    for (const size of await sizes(page)) {
      expect(size).toBeCloseTo(0.0123, 6);
    }

    // Typed entry exists precisely so the slider's ceiling is not the limit.
    const field = page.locator('#all-point-sizes-value');
    await field.fill('0.4');
    await field.blur();
    for (const size of await sizes(page)) {
      expect(size).toBeCloseTo(0.4, 6);
    }
  });

  test('goes out of sync when one file is changed on its own', async ({ page }) => {
    const slider = page.locator('#all-point-sizes-slider');
    await slider.fill('0.02');
    await slider.dispatchEvent('input');
    await expect(page.locator('#all-point-sizes-value')).toHaveValue('0.0200');

    // Change a single row through its own slider, the way a user would.
    const perFile = page.locator('#size-1');
    await perFile.fill('0.007');
    await perFile.dispatchEvent('input');

    await expect(page.locator('#all-point-sizes-value')).toHaveValue('');
    await expect(page.locator('#all-point-sizes-value')).toHaveAttribute('placeholder', 'mixed');
    // Same control shape as a file row's own, so it reads as the same thing.
    await expect(page.locator('.all-point-sizes .point-size-control .size-slider')).toHaveCount(1);
    await expect(page.locator('.all-point-sizes .point-size-control .size-input')).toHaveCount(1);
  });
});
