import { gzipSync } from 'zlib';
import { test, expect } from '@playwright/test';
const ply =
  'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n';
const source = 'https://files.example.test/cloud.ply?token=a%26b&download=1';

test.beforeEach(async ({ page }) => {
  await page.route('https://files.example.test/**', route =>
    route.fulfill({
      body: ply,
      contentType: 'application/octet-stream',
      headers: { 'access-control-allow-origin': '*' },
    })
  );
});
test('remote URL form loads a cloud and a shareable link reopens it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.getByRole('button', { name: 'Load Remote URL', exact: true }).click();
  await page.getByLabel('File URL', { exact: true }).fill(source);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('#file-list')).toContainText('cloud.ply');
  expect(new URL(page.url()).searchParams.get('source')).toBe(source);
  await page.reload();
  await expect(page.locator('#file-list')).toContainText('cloud.ply');
});
test('HTTP failure stays in the form without changing the page URL', async ({ page }) => {
  await page.route('https://files.example.test/**', route =>
    route.fulfill({ status: 404, body: 'missing' })
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Load Remote URL', exact: true }).click();
  await page.getByLabel('File URL', { exact: true }).fill(source);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('404');
  expect(new URL(page.url()).searchParams.has('source')).toBe(false);
});

test('gzip source links decompress before visualization and preserve the source URL', async ({
  page,
}) => {
  const compressedSource = 'https://files.example.test/bunny.ply.gz';
  await page.route(compressedSource, route =>
    route.fulfill({ body: gzipSync(ply), contentType: 'application/gzip' })
  );
  await page.goto(`/?source=${encodeURIComponent(compressedSource)}`);
  await expect(page.locator('#file-list')).toContainText('bunny.ply');
  await expect(page.locator('#file-list')).not.toContainText('bunny.ply.gz');
  expect(new URL(page.url()).searchParams.get('source')).toBe(compressedSource);
});
