import { gzipSync, deflateSync, deflateRawSync, brotliCompressSync } from 'zlib';
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
test('remote links reopen a cloud with no remote URL button', async ({ page }) => {
  await page.goto(`/?source=${encodeURIComponent(source)}`);
  await expect(page.locator('#file-list')).toContainText('cloud.ply');
  await expect(page.getByRole('button', { name: 'Load Remote URL' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('source')).toBe(source);
  await page.reload();
  await expect(page.locator('#file-list')).toContainText('cloud.ply');
});
test('remote link HTTP errors are displayed', async ({ page }) => {
  await page.route('https://files.example.test/**', route =>
    route.fulfill({ status: 404, body: 'missing' })
  );
  await page.goto(`/?source=${encodeURIComponent(source)}`);
  await expect(page.locator('body')).toContainText('Download failed: HTTP 404');
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

for (const [suffix, compress] of [
  ['br', brotliCompressSync],
  ['zlib', deflateSync],
  ['deflate-raw', deflateRawSync],
] as const) {
  test(`handles ${suffix} with built-in decompression`, async ({ page }) => {
    const url = `https://files.example.test/cloud.ply.${suffix}`;
    await page.route(url, route => route.fulfill({ body: compress(ply) }));
    await page.goto(`/?source=${encodeURIComponent(url)}`);
    const supported =
      suffix !== 'br' ||
      (await page.evaluate(() => {
        try {
          const Stream = DecompressionStream as new (format: string) => DecompressionStream;
          new Stream('brotli');
          return true;
        } catch {
          return false;
        }
      }));
    if (supported) {
      await expect(page.locator('#file-list')).toContainText('cloud.ply');
    } else {
      await expect(page.locator('body')).toContainText(
        'This runtime does not support brotli decompression'
      );
      await expect(page.locator('#file-list')).toBeEmpty();
    }
  });
}
