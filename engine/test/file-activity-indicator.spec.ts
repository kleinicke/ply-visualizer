import { test, expect } from '@playwright/test';

test('shows file activity for non-blocking loads and clears when loading finishes', async ({
  page,
}) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);

  const indicator = page.locator('#file-activity-indicator');
  await expect(indicator).toHaveCount(0);

  await page.evaluate(() => {
    (window as any).visualizer.showImmediateLoading({ fileName: 'activity-test.ply' });
  });
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute('aria-label', 'Loading point clouds');

  await page.evaluate(() => {
    (window as any).visualizer.showLoading(false);
  });
  await expect(indicator).toHaveCount(0);
});

test('extension activity survives geometry display and ends only on host completion', async ({
  page,
}) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  const indicator = page.locator('#file-activity-indicator');

  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.runningInVSCode = true;
    visualizer.showImmediateLoading({ fileName: 'large-site.x3a' });
    visualizer.showLoading(false);
  });
  await expect(indicator).toBeVisible();

  await page.evaluate(() => {
    (window as any).visualizer.completeBackgroundOperation();
  });
  await expect(indicator).toHaveCount(0);
});

test('activity dot uses an explicit blue independent of the editor theme', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await page.evaluate(() => {
    (window as any).visualizer.showImmediateLoading({ fileName: 'blue-test.ply' });
  });
  await expect(page.locator('.activity-dot')).toHaveCSS('background-color', 'rgb(22, 140, 255)');
});
