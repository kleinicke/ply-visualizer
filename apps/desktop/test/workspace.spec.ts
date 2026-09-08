import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const fixture = (file: string) => path.resolve(__dirname, '../../..', file);
const open = (page: any, files: any) =>
  page.locator('input[type=file]:not([webkitdirectory])').setInputFiles(files);
const cloud = fixture('engine/examples/example-point-cloud.ply');
const depth = fixture('engine/test/fixtures/npy/big_endian_depth.npy');

test('scientific image engine renders original scalar samples with new appearance controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await open(page, depth);
  const frame = page.frameLocator('iframe[title="Image engine"]');
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage?.snapshot().ready)
    )
    .toBe(true);
  await expect(page.getByRole('checkbox', { name: 'Automatic range' })).toBeVisible();
  await expect(frame.locator('#image-ui-root')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Automatic range' }).uncheck();
  await page.getByRole('spinbutton', { name: 'Minimum', exact: true }).fill('-1');
  await page.getByRole('spinbutton', { name: 'Minimum', exact: true }).press('Tab');
  await expect
    .poll(() =>
      frame
        .locator('body')
        .evaluate(() => (window as any).desktopImage.snapshot().settings.normalization.min)
    )
    .toBe(-1);
  await expect(frame.locator('body')).toHaveClass(/ready/);
  const samples = await frame
    .locator('body')
    .evaluate(() => (window as any).desktopImage.sample(0, 0));
  expect(samples.length).toBeGreaterThan(0);
  expect(Number.isFinite(samples[0])).toBe(true);
  await page.getByRole('button', { name: 'Inspect histogram', exact: true }).click();
  await expect(page.getByLabel('Sampled histogram')).toBeVisible();
  await page.screenshot({ path: path.resolve(__dirname, '../test-results/unified-image.png') });
  expect(errors).toEqual([]);
});

test('3D preview replaces the scene; explicit combine retains multiple objects', async ({
  page,
}) => {
  await page.goto('/');
  await open(page, [cloud, fixture('testfiles/stl/test_cube_ascii.stl')]);
  const frame = page.frameLocator('iframe[title="3D engine"]');
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopScene?.snapshot().objects.length)
    )
    .toBe(1);
  await expect(frame.locator('#main-ui-panel')).toBeHidden();
  await page.locator('.loose button').filter({ hasText: 'test_cube_ascii.stl' }).click();
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopScene.snapshot().objects[0]?.name)
    )
    .toContain('cube');
  await page.getByRole('checkbox', { name: 'Select example-point-cloud.ply', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select test_cube_ascii.stl', exact: true }).check();
  await page.getByRole('button', { name: 'Combine', exact: true }).click();
  await expect
    .poll(
      () =>
        frame
          .locator('body')
          .evaluate(() => (window as any).desktopScene.snapshot().objects.length),
      { timeout: 60000 }
    )
    .toBe(2);
  await page.getByRole('button', { name: 'Contents', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Show / })).toHaveCount(2);
  await expect
    .poll(() =>
      frame
        .locator('body')
        .evaluate(() =>
          Math.max(...(window as any).visualizer.camera.position.toArray().map(Math.abs))
        )
    )
    .toBeGreaterThan(1);
  const visibility = page.getByRole('checkbox', { name: /Show / });
  await visibility.first().click({ modifiers: ['Shift'] });
  await expect(visibility.nth(1)).not.toBeChecked();
  await visibility.first().click({ modifiers: ['Shift'] });
  await expect(visibility.nth(1)).toBeChecked();
  await page.screenshot({ path: path.resolve(__dirname, '../test-results/unified-scene.png') });
});

test('text preview escapes markup and rejects binary content', async ({ page }) => {
  await page.goto('/');
  await open(page, [
    {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('<script>alert(1)</script>\nWorkspace notes'),
    },
    { name: 'data.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 0, 2]) },
  ]);
  await expect(page.getByLabel('Text preview')).toContainText('<script>alert(1)</script>');
  await page.locator('.loose button').filter({ hasText: 'data.bin' }).click();
  await expect(page.getByRole('alert')).toContainText('Binary file');
});

test('collections have discrete navigation', async ({ page }) => {
  await page.goto('/');
  await open(page, [fixture('icon.png'), depth]);
  await page.getByRole('checkbox', { name: 'Select icon.png', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select big_endian_depth.npy', exact: true }).check();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.locator('.filmstrip button')).toHaveCount(2);
  await page.locator('.filmstrip button').filter({ hasText: 'icon.png' }).click();
  const frame = page.frameLocator('iframe[title="Image engine"]');
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage?.snapshot().ready)
    )
    .toBe(true);
  await expect(page.locator('.document-title')).toContainText('icon.png');
});

test('image composition uses original layers, applies visibility, and exports a PNG', async ({
  page,
}) => {
  await page.goto('/');
  await open(page, [
    {
      name: 'a.pgm',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('P2\n2 2\n255\n0 50 100 200\n'),
    },
    {
      name: 'b.pgm',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('P2\n2 2\n255\n200 100 50 0\n'),
    },
  ]);
  await page.getByRole('checkbox', { name: 'Select a.pgm', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select b.pgm', exact: true }).check();
  await page.getByRole('button', { name: 'Combine', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Image engine"]');
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage?.snapshot().layers.length)
    )
    .toBe(2);
  await page.getByRole('button', { name: 'Contents', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show b.pgm', exact: true }).uncheck();
  await expect
    .poll(() =>
      frame
        .locator('body')
        .evaluate(() => (window as any).desktopImage.snapshot().layers[1].visible)
    )
    .toBe(false);
  const opacity = page.getByLabel('Opacity b.pgm', { exact: true });
  await opacity.fill('0.4');
  await expect
    .poll(() =>
      frame
        .locator('body')
        .evaluate(() => (window as any).desktopImage.snapshot().layers[1].opacity)
    )
    .toBe(0.4);
  await opacity.dblclick();
  await expect(opacity).toHaveValue('1');
  const base = page.getByRole('checkbox', { name: 'Show a.pgm', exact: true });
  const overlay = page.getByRole('checkbox', { name: 'Show b.pgm', exact: true });
  await overlay.click({ modifiers: ['Shift'] });
  await expect(base).not.toBeChecked();
  await expect(overlay).toBeChecked();
  await overlay.click({ modifiers: ['Shift'] });
  await expect(base).toBeChecked();
  await expect(overlay).not.toBeChecked();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export…', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/view\.png$/);
  await expect(frame.locator('body')).toHaveClass(/ready/);
});

test('comparison keeps two independent scientific views and sequence playback steps through files', async ({
  page,
}) => {
  await page.goto('/');
  await open(page, [depth, fixture('icon.png')]);
  await page.getByRole('checkbox', { name: 'Select big_endian_depth.npy', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select icon.png', exact: true }).check();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.compare section')).toHaveCount(2);
  await expect(page.locator('iframe[title="Image engine"]')).toHaveCount(2);
  for (const iframe of await page.locator('iframe[title="Image engine"]').all()) {
    const frame = await iframe.elementHandle();
    await expect
      .poll(() =>
        frame!
          .contentFrame()
          .then(f => f!.evaluate(() => (window as any).desktopImage?.snapshot().ready))
      )
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Sequence', exact: true }).click();
  await expect(page.getByLabel('Sequence frame')).toBeVisible();
  await expect
    .poll(() =>
      page
        .frameLocator('iframe[title="Image engine"]')
        .locator('body')
        .evaluate(() => (window as any).desktopImage?.snapshot().ready)
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByLabel('Sequence frame')).toHaveValue('1');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
});

test('folder tree browses nested files, filters and retains pinned previews', async ({ page }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'visualizer-folder-'));
  try {
    mkdirSync(path.join(root, 'nested'));
    writeFileSync(path.join(root, 'notes.txt'), 'Workspace root');
    writeFileSync(path.join(root, 'nested', 'frame2.txt'), 'Nested frame');
    writeFileSync(path.join(root, 'nested', 'frame10.txt'), 'Next frame');
    await page.goto('/');
    await page.locator('input[webkitdirectory]').setInputFiles(root);
    await page.locator('.tree-row button').filter({ hasText: 'notes.txt' }).dblclick();
    await expect(page.getByLabel('Text preview')).toHaveText('Workspace root');
    await page.getByRole('button', { name: '▸ nested' }).click();
    await page.locator('.tree-row button').filter({ hasText: 'frame2.txt' }).click();
    await expect(page.getByLabel('Text preview')).toHaveText('Nested frame');
    await page.locator('.tree-row button').filter({ hasText: 'frame10.txt' }).click();
    await expect(page.locator('.tabs .tab')).toHaveCount(2);
    await page.getByLabel('Filter files').fill('frame?.txt');
    await expect(page.locator('.tree-row button').filter({ hasText: 'frame10.txt' })).toHaveCount(
      0
    );
    await expect(page.locator('.tree-row button').filter({ hasText: 'frame2.txt' })).toBeVisible();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('depth view uses original samples and cancellation can be retried', async ({ page }) => {
  await page.goto('/');
  await open(page, depth);
  const image = page.frameLocator('iframe[title="Image engine"]');
  await expect
    .poll(() =>
      image.locator('body').evaluate(() => (window as any).desktopImage?.snapshot().ready)
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Create 3D view…', exact: true }).click();
  const scene = page.frameLocator('iframe[title="3D engine"]');
  await expect
    .poll(() =>
      scene.locator('#hiddenFileInput').evaluate((e: HTMLInputElement) => e.files?.[0]?.name)
    )
    .toBe('big_endian_depth.npy');
  await scene.locator('#depth-cancel').click();
  await expect(page.getByRole('alert')).toContainText('cancelled');
  await page.locator('.tab button').filter({ hasText: 'big_endian_depth.npy' }).first().click();
  await page.getByRole('button', { name: 'Create 3D view…', exact: true }).click();
  await scene.getByRole('button', { name: 'Convert to Point Cloud', exact: true }).click();
  await expect
    .poll(() =>
      scene.locator('body').evaluate(() => (window as any).desktopScene?.snapshot().objects.length)
    )
    .toBe(1);
  await page.locator('.tab button').filter({ hasText: 'big_endian_depth.npy' }).first().click();
  await expect(image.locator('body')).toHaveClass(/ready/);
  await page.locator('.tab button').filter({ hasText: 'big_endian_depth.npy · 3D' }).last().click();
  await expect(scene.locator('#depth-cancel')).toBeHidden();
  await expect
    .poll(() =>
      scene.locator('body').evaluate(() => (window as any).desktopScene.snapshot().objects.length)
    )
    .toBe(1);
});

test('pinned scenes restore object appearance after another source is viewed', async ({ page }) => {
  await page.goto('/');
  await open(page, [cloud, fixture('testfiles/stl/test_cube_ascii.stl')]);
  const scene = page.frameLocator('iframe[title="3D engine"]');
  await expect(page.getByLabel('Point size')).toBeVisible();
  await page.getByLabel('Point size').fill('0.05');
  await page.getByLabel('Point size').press('Tab');
  await expect
    .poll(() =>
      scene.locator('body').evaluate(() => (window as any).desktopScene.snapshot().objects[0]?.size)
    )
    .toBe(0.05);
  await page.locator('.loose button').filter({ hasText: 'test_cube_ascii.stl' }).click();
  await expect
    .poll(() =>
      scene.locator('body').evaluate(() => (window as any).desktopScene.snapshot().objects[0]?.name)
    )
    .toContain('cube');
  await page.locator('.tabs button').filter({ hasText: 'example-point-cloud.ply' }).click();
  await expect(page.getByLabel('Point size')).toHaveValue('0.05');
});

test('multi-page TIFF exposes page navigation and DICOM uses the scientific decoder', async ({
  page,
}) => {
  await page.goto('/');
  await open(page, path.resolve(__dirname, 'fixtures/multipage_description_only.tif'));
  const frame = page.frameLocator('iframe[title="Image engine"]');
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage?.snapshot().ready)
    )
    .toBe(true);
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage.snapshot().axes.length)
    )
    .toBeGreaterThan(0);
  const axis = await frame
    .locator('body')
    .evaluate(() => (window as any).desktopImage.snapshot().axes[0]);
  expect(axis.size).toBeGreaterThan(1);
  const control = page.locator('.axes').locator('select,input').first();
  if ((await control.evaluate(e => e.tagName)) === 'SELECT') {
    await control.selectOption('1');
  } else {
    await control.fill('1');
  }
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage.snapshot().axes[0].value)
    )
    .toBe(1);
  await open(page, path.resolve(__dirname, 'fixtures/synthetic-ct.dcm'));
  await expect
    .poll(() => frame.locator('body').evaluate(() => (window as any).desktopImage.snapshot().size))
    .toBe('32 × 24');
  await expect(frame.locator('body')).toHaveClass(/ready/);
});

test('PNG uses Rust for original 16-bit samples and native decoding for embedded layers without UPNG', async ({
  page,
}) => {
  const resources: string[] = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('/');
  await open(page, fixture('testfiles/png/test_depth_16bit_mm.png'));
  const frame = page.frameLocator('iframe[title="Image engine"]');
  await expect
    .poll(() =>
      frame.locator('body').evaluate(() => (window as any).desktopImage?.snapshot().ready)
    )
    .toBe(true);
  const sample = await frame
    .locator('body')
    .evaluate(() => (window as any).desktopImage.sample(20, 20));
  expect(sample[0]).toBeGreaterThan(255);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL().split(',')[1];
  });
  const { zipSync, strToU8 } = await import('fflate');
  const bytes = Buffer.from(png, 'base64');
  const archive = zipSync({
    mimetype: strToU8('image/openraster'),
    'mergedimage.png': bytes,
    'data/layer.png': bytes,
    'stack.xml': strToU8(
      '<image w="2" h="2"><stack><layer name="Red" src="data/layer.png" opacity="1" visibility="visible" composite-op="svg:src-over"/></stack></image>'
    ),
  });
  writeFileSync(path.resolve(__dirname, '../test-results/native-png.ora'), archive);
  await open(page, {
    name: 'native-png.ora',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(archive),
  });
  await expect
    .poll(() => frame.locator('body').evaluate(() => (window as any).desktopImage.snapshot().size))
    .toBe('2 × 2');
  await page.getByRole('button', { name: 'Contents', exact: true }).click();
  await page.getByRole('button', { name: 'Explore file layers', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Show Red', exact: true })).toBeVisible();
  expect(await frame.locator('body').evaluate(() => (window as any).UPNG)).toBeUndefined();
  expect(resources.some(url => /upng/i.test(url))).toBe(false);
});
