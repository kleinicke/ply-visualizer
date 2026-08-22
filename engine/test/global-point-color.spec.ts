import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('All point colors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_ascii.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  });

  test('offers the union, leaves incompatible clouds and mixed sizes unchanged', async ({
    page,
  }) => {
    const firstSize = page.locator('#size-0');
    const secondSize = page.locator('#size-1');
    await firstSize.fill('0.003');
    await firstSize.dispatchEvent('input');
    await secondSize.fill('0.008');
    await secondSize.dispatchEvent('input');

    await page.locator('#color-0').selectOption('assigned');
    await page.locator('#color-1').selectOption('1');

    const allColors = page.locator('#all-point-colors-select');
    await expect(allColors).toBeVisible();
    await expect(allColors.locator('option[value="original"]')).toHaveText('Original (1/2)');
    await allColors.selectOption('original');

    const state = await page.evaluate(() => ({
      colors: (window as any).visualizer.individualColorModes.slice(0, 2),
      sizes: (window as any).visualizer.pointSizes.slice(0, 2),
    }));
    expect(state.colors).toEqual(['original', '1']);
    expect(state.sizes[0]).toBeCloseTo(0.003, 6);
    expect(state.sizes[1]).toBeCloseTo(0.008, 6);
    await expect(page.locator('#all-point-sizes-value')).toHaveValue('');
    await expect(page.locator('#all-point-sizes-value')).toHaveAttribute('placeholder', 'mixed');
  });

  test('applies universally available flat colors to every cloud', async ({ page }) => {
    await page.locator('#all-point-colors-select').selectOption('0');
    expect(
      await page.evaluate(() => (window as any).visualizer.individualColorModes.slice(0, 2))
    ).toEqual(['0', '0']);
    await expect(page.locator('#all-point-colors-select')).toHaveValue('0');
  });
});
