import { test, expect } from '@playwright/test';

test('Phase 6: Files tab is active by default', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await expect(page.locator('[data-tab="files"]')).toHaveClass(/active/);
  await expect(page.locator('#files-tab')).toHaveClass(/active/);
  await expect(page.locator('[data-tab="camera"]')).not.toHaveClass(/active/);

  await page.click('[data-tab="controls"]');
  await expect(page.locator('[data-tab="controls"]')).toHaveClass(/active/);
  await expect(page.locator('[data-tab="files"]')).not.toHaveClass(/active/);
  await expect(page.locator('#controls-tab')).toHaveClass(/active/);
});
