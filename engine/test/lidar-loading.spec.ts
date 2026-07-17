import { expect, test } from '@playwright/test';
import path from 'path';

const fixture = (name: string) => path.resolve(`test/fixtures/lidar/${name}`);

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
});

for (const name of ['attributes.las', 'attributes.laz']) {
  test(`loads ${name} with RGB and LAS scalar attributes`, async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles(fixture(name));
    await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator('#file-list')).toContainText(name);

    const options = await page.locator('#color-0 option').allTextContents();
    expect(options).toContain('classification (Viridis)');
    expect(options).toContain('returnNumber (Viridis)');
    expect(options).toContain('gpsTime (Viridis)');
    await expect(page.locator('#three-canvas')).toBeVisible();
  });
}

test('loads every E57 scan as an independent aligned entry', async ({ page }) => {
  await page.locator('#hiddenFileInput').setInputFiles(fixture('multi-scan.e57'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator('#file-list')).toContainText('Scan one');
  await expect(page.locator('#file-list')).toContainText('Scan two');
  await expect(page.locator('#three-canvas')).toBeVisible();
});
