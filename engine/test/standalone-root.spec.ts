import { expect, test } from '@playwright/test';
import path from 'path';

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

test('loads the guided release example with its predefined presentation', async ({ page }) => {
  await page.route('https://analytics.re4vive.com/**', route => route.abort());
  await page.route('**/examples/test_pc2_binary-v1.7.0.ply', route =>
    route.fulfill({
      path: path.resolve('examples/example-point-cloud.ply'),
      contentType: 'application/octet-stream',
    })
  );
  await page.goto('/');
  await page.evaluate(() => {
    (window as any).__plausibleEvents = [];
    (window as any).plausible = (...args: unknown[]) => {
      (window as any).__plausibleEvents.push(args);
    };
  });

  await page.getByRole('button', { name: 'Guided example' }).click();

  await expect(page.locator('#file-list')).toContainText('test_pc2_binary.ply', {
    timeout: 30_000,
  });
  await expect(page.locator('#welcome-message')).toHaveClass(/hidden/);
  await expect(page.locator('#three-canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__plausibleEvents))
    .toContainEqual(['Example Point Cloud Loaded']);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const visualizer: any = (window as any).visualizer;
        const measurementProject = JSON.parse(visualizer.measurementManager.buildPathProjectJson());
        return {
          colorMode: visualizer.individualColorModes[0],
          edlEnabled: visualizer.edlEnabled,
          edlMode: visualizer.edlMode,
          keyframes: visualizer.filmManager.getKeyframes().length,
          playing: visualizer.filmManager.isPlaying(),
          measurementPathCount: measurementProject.paths.length,
          measurementPointCount: measurementProject.paths[0]?.points.length,
          measurementClosed: measurementProject.paths[0]?.closed,
        };
      })
    )
    .toEqual({
      colorMode: '0',
      edlEnabled: true,
      edlMode: 'auto',
      keyframes: 4,
      playing: true,
      measurementPathCount: 1,
      measurementPointCount: 3,
      measurementClosed: true,
    });

  await page.click('[data-tab="controls"]');
  await expect(page.locator('#opengl-convention')).toHaveClass(/active/);
  await expect(page.locator('#close-measurement-path')).toHaveClass(/active/);
});

test('keeps the original point cloud as a basic example with automatic EDL', async ({ page }) => {
  await page.route('https://analytics.re4vive.com/**', route => route.abort());
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Guided example' })).toBeVisible();
  await page.getByRole('button', { name: 'Basic example' }).click();

  await expect(page.locator('#file-list')).toContainText('example-point-cloud.ply', {
    timeout: 30_000,
  });
  await expect.poll(() => page.evaluate(() => (window as any).visualizer.edlMode)).toBe('auto');
});
