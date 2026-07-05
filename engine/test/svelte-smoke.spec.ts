import { test, expect } from '@playwright/test';

test('Svelte Phase 0 tooling smoke test mounts inside the real webview bundle', async ({
  page,
}) => {
  await page.goto('/3d-visualizer/');
  await page.waitForTimeout(1000);

  const marker = page.locator('#svelte-smoke-test');
  await expect(marker).toBeAttached();
  await expect(marker).toHaveText('Svelte 0');
  await expect(marker).toHaveAttribute('data-count', '0');
});
