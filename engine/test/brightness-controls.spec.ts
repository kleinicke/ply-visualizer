import { test, expect } from '@playwright/test';

test('brightness sliders update their labels and reset on double-click', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.click('[data-tab="controls"]');

  const brightness = page.locator('#brightness-slider');
  await brightness.fill('1.2');
  await expect(page.locator('#brightness-value')).toHaveText('1.2');
  await brightness.dblclick();
  await expect(brightness).toHaveValue('0');
  await expect(page.locator('#brightness-value')).toHaveText('0.0');

  const background = page.locator('#background-brightness-slider');
  await background.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = '50';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#background-brightness-value')).toHaveText('50% (#808080)');
  await background.dblclick();
  await expect(background).toHaveValue('13');
  await expect(page.locator('#background-brightness-value')).toHaveText('13% (#212121)');
});
