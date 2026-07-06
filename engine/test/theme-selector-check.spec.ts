import { test, expect } from '@playwright/test';

test('Phase 6: theme selector still works after shell consolidation', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);

  const themeSelector = page.locator('#theme-selector');
  await expect(themeSelector).toBeVisible();
  await themeSelector.selectOption('light-modern');
  await page.waitForTimeout(500);
  const bodyBg = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue('--vscode-editor-background')
  );
  console.log('bg after light theme:', bodyBg);
  await themeSelector.selectOption('dark-modern');
});
