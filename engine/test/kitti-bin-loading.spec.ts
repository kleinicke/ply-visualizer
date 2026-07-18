import { expect, test } from '@playwright/test';
import path from 'path';

const fixture = (name: string) => path.resolve(`test/fixtures/kitti/${name}`);

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
});

test('loads a KITTI .bin scan with reflectance as intensity', async ({ page }) => {
  await page.locator('#hiddenFileInput').setInputFiles(fixture('mini.bin'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator('#file-list')).toContainText('mini.bin');

  // 100 points in the fixture; the file item shows the vertex count
  await expect(page.locator('#file-list .file-item .file-info')).toContainText('100 vertices');

  // Reflectance is exposed as intensity, so intensity color modes must be offered
  const options = await page.locator('#color-0 option').allTextContents();
  expect(options).toContain('Intensity');
  expect(options).toContain('Intensity (Viridis)');

  await expect(page.locator('#three-canvas')).toBeVisible();
});
