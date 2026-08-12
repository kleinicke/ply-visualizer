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
  await expect(page.locator('#color-0')).toHaveValue('original');
  await expect(page.locator('#color-0 option:checked')).toHaveText('Camera colour (projected)');
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

test('raw colour crosses once and is corrected in the webview', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);

  const result = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const data = visualizer.spatialFiles[0];
    data.colorsArray = null;
    data.hasColors = false;
    data.metadata = { ...(data.metadata ?? {}), embeddedScanName: 'Site_raw.x3r' };
    const raw = new Uint8Array(data.vertexCount * 3);
    for (let point = 0; point < data.vertexCount; point++) {
      raw.set([10, 20, 30], point * 3);
    }
    const applied = (window as any).stationPipelineFeature.applyLoadTimeColors(visualizer, [
      {
        scanName: 'Site_raw.x3r',
        colors: raw,
        colorsAreRaw: true,
        frameIndices: new Uint16Array(data.vertexCount),
        colorCalibration: {
          frames: [{ type: 'U', grayRedGain: 2, grayBlueGain: 3, meanGreen: 20 }],
          bandGains: { U: { redGain: 2, blueGain: 3 } },
          targetGreen: 20,
        },
      },
    ]);
    return {
      applied,
      scanName: data.metadata.embeddedScanName,
      raw: data.metadata.stonexRawColors
        ? Array.from(data.metadata.stonexRawColors.slice(0, 3))
        : null,
      corrected: data.colorsArray ? Array.from(data.colorsArray.slice(0, 3)) : null,
    };
  });

  expect(result).toMatchObject({ applied: 1, scanName: 'Site_raw.x3r' });
  expect(result.raw).toEqual([10, 20, 30]);
  expect(result.corrected).toEqual([20, 20, 90]);
});

test('colour arriving before its geometry is queued and flushed', async ({ page }) => {
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
    const before = feature.applyLoadTimeColors(visualizer, [
      {
        scanName: 'Late_geometry.x3r',
        colors: new Uint8Array(data.vertexCount * 3).fill(44),
        frameIndices: new Uint16Array(data.vertexCount),
      },
    ]);
    data.metadata = { ...(data.metadata ?? {}), embeddedScanName: 'Late_geometry.x3r' };
    const after = feature.flushPendingLoadTimeColors(visualizer);
    return {
      before,
      after,
      first: Array.from(data.colorsArray.slice(0, 3)),
    };
  });

  expect(result).toEqual({ before: 0, after: 1, first: [44, 44, 44] });
});
