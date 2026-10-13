import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * An idle depth worker is ended to free its wasm memory, after handing its
 * decoded images to the page. A later parameter change must still skip the
 * decode and produce the same points.
 */
test('a parked depth worker keeps parameter changes decode-free and exact', async ({ page }) => {
  const perfLines: string[] = [];
  page.on('console', message => {
    if (message.text().includes('PERF[')) {
      perfLines.push(message.text());
    }
  });
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles(path.resolve('../testfiles/tif/depth.tif'));
  await page.locator('#depth-ok').click({ timeout: 10000 });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 15000 });

  const points = () =>
    page.evaluate(() => {
      const positions: Float32Array = (window as any).visualizer.spatialFiles[0].positionsArray;
      return Array.from(positions);
    });
  const before = await points();

  // What the idle timer runs.
  const parked = await page.evaluate(async () => {
    const client = (window as any).visualizer.depthWorkerClient;
    await client.park();
    return { images: client.parked.size, worker: client.worker !== undefined };
  });
  expect(parked).toEqual({ images: 1, worker: false });

  perfLines.length = 0;
  await page.evaluate(() => (window as any).visualizer.applyDepthSettings(0));
  expect(await points()).toEqual(before);
  const reapply = perfLines.find(line => line.includes('PERF[depth/reapply'));
  expect(reapply, perfLines.join('\n')).toBeDefined();
  expect(reapply).toContain('decode(cached)');
  expect(await page.evaluate(() => (window as any).visualizer.depthWorkerClient.parked.size)).toBe(
    0
  );
});
