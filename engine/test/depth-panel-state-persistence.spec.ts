import { test, expect } from '@playwright/test';
import path from 'path';

/** Stable keyed rows must retain native form state through every list refresh. */
test.describe('Depth panel state across a file-list refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(1000);
  });

  test('loading another file preserves an open panel and its in-progress edit', async ({
    page,
  }) => {
    const tifPath = path.resolve('../testfiles/tif/depth.tif');
    await page.locator('#hiddenFileInput').setInputFiles(tifPath);

    const okButton = page.locator('#depth-ok');
    await expect(okButton).toBeVisible({ timeout: 10000 });
    await page.locator('#depth-fx').fill('600');
    await okButton.click();
    await page.waitForTimeout(2000);

    await page.locator('.depth-settings-toggle[data-file-index="0"]').click();
    await expect(page.locator('#depth-panel-0')).toBeVisible();
    await page.locator('#fx-0').fill('700');

    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);

    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await expect(page.locator('#depth-panel-0')).toBeVisible();
    await expect(page.locator('#fx-0')).toHaveValue('700');
  });
});
