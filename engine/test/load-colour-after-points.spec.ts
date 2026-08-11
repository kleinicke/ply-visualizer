import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Colour arriving after the points are already on screen.
 *
 * An X3A load now hands the geometry over first - colour is roughly 80% of the
 * parse, so the scene appears seconds sooner - and the photographs follow, one
 * message per scan. The first attempt at this shipped every scan's colour in a
 * single message and it never arrived, with nothing said either way, so the
 * arrival half gets its own test.
 */
test('a scan shown without colour takes it when it arrives', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);

  const before = await page.evaluate(() => {
    const data = (window as any).visualizer.spatialFiles[0];
    // Stand in for a geometry-only scan: points, no colour.
    data.colorsArray = null;
    data.hasColors = false;
    data.metadata = { ...(data.metadata ?? {}), embeddedScanName: 'Site_0001.x3r' };
    (window as any).visualizer.updateFileList();
    return { hasColors: data.hasColors };
  });
  expect(before.hasColors).toBe(false);

  const after = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const data = visualizer.spatialFiles[0];
    (window as any).stationPipelineFeature.applyLoadTimeColors(visualizer, [
      {
        scanName: 'Site_0001.x3r',
        colors: new Uint8Array(data.vertexCount * 3).fill(88),
        rawColors: new Uint8Array(data.vertexCount * 3).fill(88),
        frameIndices: new Uint16Array(data.vertexCount),
        photographicallyColoredPoints: data.vertexCount,
      },
    ]);
    return {
      hasColors: data.hasColors,
      mode: visualizer.individualColorModes[0],
      first: Array.from((data.colorsArray as Uint8Array).slice(0, 3)) as number[],
    };
  });

  expect(after.hasColors).toBe(true);
  expect(after.mode).toBe('original');
  expect(after.first).toEqual([88, 88, 88]);
  // The picker has to offer the mode it was just switched to.
  await expect(page.locator('#color-0 option[value="original"]')).toHaveCount(1);
});

test('colour that arrives in chunks is reassembled', async ({ page }) => {
  // A webview's structured clone drops payloads of tens of megabytes without
  // reporting anything, so a large scan's colour travels in pieces. Nothing may
  // be shown until the closing piece lands, or a half-filled array reaches the
  // screen.
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);

  const result = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const feature = (window as any).stationPipelineFeature;
    const data = visualizer.spatialFiles[0];
    data.colorsArray = null;
    data.hasColors = false;
    data.metadata = { ...(data.metadata ?? {}), embeddedScanName: 'Site_0001.x3r' };
    visualizer.updateFileList();

    const points = data.vertexCount;
    const half = Math.floor(points / 2);
    const send = (offset: number, count: number, value: number, final: boolean) =>
      feature.applyLoadTimeColors(visualizer, [
        {
          scanName: 'Site_0001.x3r',
          pointOffset: offset,
          pointCount: count,
          totalPoints: points,
          colors: new Uint8Array(count * 3).fill(value),
          final,
        },
      ]);

    send(0, half, 11, false);
    const afterFirst = { hasColors: data.hasColors };
    send(half, points - half, 22, true);

    const colors = data.colorsArray as Uint8Array;
    return {
      afterFirst,
      length: colors.length,
      firstChunk: colors[0],
      secondChunk: colors[half * 3],
      hasColors: data.hasColors,
    };
  });

  // Nothing is published until the last piece arrives...
  expect(result.afterFirst.hasColors).toBe(false);
  // ...and then the whole array is there, both pieces in their right places.
  expect(result.hasColors).toBe(true);
  expect(result.firstChunk).toBe(11);
  expect(result.secondChunk).toBe(22);
});
