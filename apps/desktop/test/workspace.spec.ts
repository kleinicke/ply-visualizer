import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
const fixture = (name: string) => path.resolve(__dirname, '../../..', name);

test('opens PLY in 3D, ordinary images in 2D, and keeps the scene when switching back', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Tauri adds nonces to style-src in packaged HTML. That makes its
  // unsafe-inline ineffective for style attributes unless style-src-attr is
  // explicit. Exercise that native policy difference in the browser as well.
  const config = JSON.parse(
    readFileSync(path.resolve(__dirname, '../src-tauri/tauri.conf.json'), 'utf8')
  );
  const styles = config.app.security.csp
    .split(';')
    .map((part: string) => part.trim())
    .filter((part: string) => /^style-src(?:\s|-attr\s)/.test(part))
    .map((part: string) => (part.startsWith('style-src ') ? `${part} 'nonce-native-test'` : part))
    .join('; ');
  await page.route('**/viewers/3d/index.html?*', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': styles },
    });
  });
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles(fixture('engine/examples/example-point-cloud.ply'));
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#file-list .file-item')).toHaveCount(1);
  const heading = await frame.getByRole('heading', { name: 'File Management' }).boundingBox();
  const stats = await frame.locator('#performance-stats').boundingBox();
  expect(heading).not.toBeNull();
  expect(stats).not.toBeNull();
  expect(Math.abs(heading!.y + heading!.height / 2 - (stats!.y + stats!.height / 2))).toBeLessThan(
    2
  );
  expect(stats!.x).toBeGreaterThan(heading!.x + heading!.width);
  await page.locator('input[type=file]').setInputFiles(fixture('icon.png'));
  await expect(page.getByRole('region', { name: 'Image viewer' })).toBeVisible();
  await expect(page.locator('.image-canvas img')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.image-canvas img').evaluate((img: HTMLImageElement) => img.naturalWidth)
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'example-point-cloud.ply', exact: true }).click();
  await expect(frame.locator('#file-list .file-item')).toHaveCount(1);
  await expect(page.locator('iframe')).toBeVisible();
  await page.screenshot({ path: path.resolve(__dirname, '../test-results/desktop-3d.png') });
  expect(errors).toEqual([]);
});

test('previews scalar depth in 2D and opens its original source for 3D configuration', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles(fixture('engine/test/fixtures/npy/big_endian_depth.npy'));
  await expect(page.locator('.image-canvas img')).toBeVisible();
  await expect(page.locator('.image-info')).toContainText('Scalar preview');
  await page.screenshot({ path: path.resolve(__dirname, '../test-results/desktop-depth.png') });
  await page.getByRole('button', { name: 'View in 3D', exact: true }).click();
  await expect(page.locator('iframe')).toBeVisible();
  // The engine owns interpretation and camera calibration. The original file,
  // rather than the display-normalized PNG, reaches its file handler.
  await expect
    .poll(() =>
      page
        .frameLocator('iframe')
        .locator('#hiddenFileInput')
        .evaluate((input: HTMLInputElement) => input.files?.[0].name)
    )
    .toBe('big_endian_depth.npy');
  await page.frameLocator('iframe').locator('#depth-cancel').click();
  await expect(page.locator('footer')).toContainText('cancelled');
  await page.getByRole('button', { name: 'View in 3D', exact: true }).click();
  await page
    .frameLocator('iframe')
    .getByRole('button', { name: 'Convert to Point Cloud', exact: true })
    .click();
  await expect(page.frameLocator('iframe').locator('#file-list .file-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(page.locator('.image-canvas img')).toBeVisible();
});

test('exports a real PNG through the host saving interface', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles(fixture('engine/examples/example-point-cloud.ply'));
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#file-list .file-item')).toHaveCount(1);
  await frame.locator('[data-tab=camera]').click();
  const download = page.waitForEvent('download');
  await frame.locator('#save-screenshot').click();
  expect((await download).suggestedFilename()).toMatch(/^pointcloud-.*\.png$/);
});

test('rejects unsupported files with a useful error', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert')).toContainText('Unsupported file: notes.txt');
});
