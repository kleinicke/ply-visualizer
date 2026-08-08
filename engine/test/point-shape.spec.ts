import { test, expect, Page } from '@playwright/test';

/** All point sizes use the same round-disc sprite. */

function buildSmallPly(pointCount: number): Buffer {
  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    `element vertex ${pointCount}\n` +
    'property float x\n' +
    'property float y\n' +
    'property float z\n' +
    'end_header\n';

  const body = Buffer.alloc(pointCount * 12);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < pointCount; i++) {
    body.writeFloatLE(rand() * 2 - 1, i * 12);
    body.writeFloatLE(rand() * 2 - 1, i * 12 + 4);
    body.writeFloatLE(rand() * 2 - 1, i * 12 + 8);
  }
  return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

async function loadPly(page: Page, buffer: Buffer, name: string): Promise<void> {
  await page.click('#add-file');
  await page.locator('#hiddenFileInput').setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer,
  });

  const loading = page.locator('#loading');
  if (await loading.isVisible()) {
    await expect(loading).toBeHidden({ timeout: 60000 });
  }
  await page.waitForTimeout(1000);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined, { timeout: 30000 });
});

test('default-size points use the round-disc texture', async ({ page }) => {
  await loadPly(page, buildSmallPly(1000), 'small.ply');

  const shape = await page.evaluate(() => {
    const mesh = (window as any).visualizer.meshes[0];
    return { hasMap: mesh.material.map !== null, alphaTest: mesh.material.alphaTest };
  });

  expect(shape.hasMap).toBe(true);
  expect(shape.alphaTest).toBe(0.5);
});

test('enlarging points restores the round-disc texture', async ({ page }) => {
  await loadPly(page, buildSmallPly(1000), 'small.ply');

  const shape = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.updatePointSize(0, 0.05);
    const mesh = visualizer.meshes[0];
    return { hasMap: mesh.material.map !== null, alphaTest: mesh.material.alphaTest };
  });

  expect(shape.hasMap).toBe(true);
  expect(shape.alphaTest).toBe(0.5);
});
