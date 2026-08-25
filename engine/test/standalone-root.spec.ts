import { expect, test } from '@playwright/test';

test('standalone deployment serves the visualizer at its root', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('3D Point Cloud Visualizer');
  await expect(page.locator('#viewer-container')).toBeVisible();
  await expect(page.getByRole('link', { name: 'About' })).toHaveAttribute(
    'href',
    'https://f-kleinicke.de/'
  );
  await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
    'href',
    'https://f-kleinicke.de/impressum.html'
  );
});

test('can launch as a home-screen app without browser chrome', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes'
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    'manifest.webmanifest'
  );
  const manifest = await page.evaluate(async () =>
    fetch('manifest.webmanifest').then(response => response.json())
  );
  expect(manifest.display).toBe('standalone');
});

test('mobile file picker allows files from document providers', async ({ page }) => {
  await page.goto('/');

  const fileInput = page.locator('#hiddenFileInput');
  await expect(fileInput).toHaveAttribute('multiple', '');
  expect(await fileInput.getAttribute('accept')).toBeNull();
  expect(await fileInput.evaluate(element => getComputedStyle(element).display)).not.toBe('none');
});

test('mobile keeps the legal navigation in the bottom right', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const navigation = page.locator('.bottom-right-nav');
  await expect(navigation).toBeVisible();
  const bounds = await navigation.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeGreaterThan(300);
  expect(bounds!.y + bounds!.height).toBeGreaterThan(760);
});

test('mobile long press cannot select the standalone website', async ({ page }) => {
  await page.goto('/');

  await expect
    .poll(() => page.locator('body').evaluate(element => getComputedStyle(element).userSelect))
    .toBe('none');
});

test('loads the bundled example point cloud from the welcome message', async ({ page }) => {
  await page.route('https://analytics.re4vive.com/**', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => {
    (window as any).__plausibleEvents = [];
    (window as any).plausible = (...args: unknown[]) => {
      (window as any).__plausibleEvents.push(args);
    };
  });

  await page.getByRole('button', { name: 'Load example' }).click();

  await expect(page.locator('#file-list')).toContainText('example-point-cloud.ply', {
    timeout: 30_000,
  });
  await expect(page.locator('#welcome-message')).toHaveClass(/hidden/);
  await expect(page.locator('#three-canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__plausibleEvents))
    .toContainEqual(['Example Point Cloud Loaded']);
});
