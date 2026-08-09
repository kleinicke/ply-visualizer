import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The cross-station colour lands in its own mode.
 *
 * The scan's native colour has to survive — comparing the two is the point —
 * so the result goes into its own array under "Recolored", "Original" keeps
 * showing what the scan's own camera produced, and the mode is selected
 * automatically once there is something to look at.
 */
test.describe('Recolored colour mode', () => {
  test('appears only once a result exists, and preserves the original', async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);

    const selector = page.locator('#color-0');
    await expect(selector.locator('option[value="recolored"]')).toHaveCount(0);

    // Feed a result the way the extension host would.
    const originalColors = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const data = visualizer.spatialFiles[0];
      data.metadata = {
        ...(data.metadata ?? {}),
        embeddedScanName: 'Site_0001.x3r',
        containerFileName: 'Site.x3a',
      };
      // Give the scan a known native colour, so "the original is untouched" is
      // an assertion about this code rather than about the fixture.
      const count = data.vertexCount;
      data.colorsArray = new Uint8Array(count * 3).fill(200);
      data.hasColors = true;
      const before = Array.from(data.colorsArray.slice(0, 6));
      // Called directly rather than posted: main.ts only installs its message
      // listener inside a real webview.
      (window as any).__applyResult = () =>
        (window as any).stationPipelineFeature.handleStationPipelineResult(visualizer, {
          summary: 'test',
          updates: [
            {
              scanName: 'Site_0001.x3r',
              transform: null,
              rawColors: new Uint8Array(count * 3).fill(17),
              frameIndices: new Uint16Array(count),
              photographicallyColoredPoints: count,
            },
          ],
        });
      return before;
    });

    await page.evaluate(() => (window as any).__applyResult());
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => {
      const data = (window as any).visualizer.spatialFiles[0];
      return {
        mode: (window as any).visualizer.individualColorModes[0],
        original: Array.from(data.colorsArray.slice(0, 6)) as number[],
        recolored: Array.from(
          (data.metadata.stationRecoloredColors as Uint8Array).slice(0, 6)
        ) as number[],
      };
    });

    // Switched to the new mode automatically, and the option it points at
    // exists — a value with no matching option renders as a blank picker with
    // no way back, which is exactly what happened before the rows refreshed.
    expect(state.mode).toBe('recolored');
    await expect(page.locator('#color-0 option[value="recolored"]')).toHaveCount(1);
    await expect(page.locator('#color-0')).toHaveValue('recolored');
    // ...the recoloured array carries the result...
    expect(state.recolored.every(value => value === 17)).toBe(true);
    // ...and the scan's own colour is untouched.
    expect(state.original).toEqual(originalColors);
  });

  test('names the projected colour for what it is', async ({ page }) => {
    // An X3R sample is a range and a pulse width; every colour on these points
    // was projected from the archive's photographs by this extension, so
    // calling it "Original" hides the very distinction the second mode exists
    // to draw.
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);

    // A plain mesh keeps "Original".
    await page.evaluate(() => {
      const data = (window as any).visualizer.spatialFiles[0];
      data.colorsArray = new Uint8Array(data.vertexCount * 3).fill(200);
      data.hasColors = true;
      (window as any).visualizer.updateFileList();
    });
    await expect(page.locator('#color-0 option[value="original"]')).toHaveText('Original');

    // The same file, once its colour came from our own projection.
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const data = visualizer.spatialFiles[0];
      data.metadata = {
        ...(data.metadata ?? {}),
        stonexRawColors: new Uint8Array(data.vertexCount * 3),
      };
      visualizer.updateFileList();
    });
    await expect(page.locator('#color-0 option[value="original"]')).toHaveText(
      'Camera (own station)'
    );
  });

  test('goes white when the run starts and fills in per scan', async ({ page }) => {
    // The run takes a minute on a real archive. Blanking the scans first and
    // painting each one as it lands is what makes it legible; without it the
    // view sits unchanged and then flips in a single step.
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const state = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const feature = (window as any).stationPipelineFeature;
      ['A', 'B'].forEach((suffix, index) => {
        const data = visualizer.spatialFiles[index];
        data.colorsArray = new Uint8Array(data.vertexCount * 3).fill(10);
        data.hasColors = true;
        data.metadata = {
          ...(data.metadata ?? {}),
          containerFileName: 'Site.x3a',
          embeddedScanName: `Site_000${index}${suffix}.x3r`,
        };
      });
      visualizer.updateFileList();

      feature.beginStationRecolor(visualizer, 'Site.x3a');
      const whiteAfterStart = [0, 1].map(index =>
        Array.from(
          (visualizer.spatialFiles[index].metadata.stationRecoloredColors as Uint8Array).slice(0, 3)
        )
      );

      // One scan reports in; the other must still be white.
      feature.handleStationPipelineResult(visualizer, {
        partial: true,
        updates: [
          {
            scanName: 'Site_0000A.x3r',
            transform: null,
            partial: true,
            rawColors: new Uint8Array(visualizer.spatialFiles[0].vertexCount * 3).fill(42),
            frameIndices: new Uint16Array(visualizer.spatialFiles[0].vertexCount),
          },
        ],
      });

      return {
        whiteAfterStart,
        modes: [0, 1].map(index => visualizer.individualColorModes[index]),
        afterFirstScan: [0, 1].map(index =>
          Array.from(
            (visualizer.spatialFiles[index].metadata.stationRecoloredColors as Uint8Array).slice(
              0,
              3
            )
          )
        ),
      };
    });

    // Both blanked and switched to the camera view up front...
    expect(state.whiteAfterStart).toEqual([
      [255, 255, 255],
      [255, 255, 255],
    ]);
    expect(state.modes).toEqual(['recolored', 'recolored']);
    // ...then the reported scan is painted while the other waits its turn.
    expect(state.afterFirstScan[0]).not.toEqual([255, 255, 255]);
    expect(state.afterFirstScan[1]).toEqual([255, 255, 255]);
  });

  test('gives every scan the view, even one nothing could improve', async ({ page }) => {
    // "All stations" is a view, not a diff. A single-station archive's only
    // camera already produced what it would show, so the scan keeps the mode
    // with its own colour in it rather than being handed back or left white.
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);

    const state = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const feature = (window as any).stationPipelineFeature;
      const data = visualizer.spatialFiles[0];
      data.colorsArray = new Uint8Array(data.vertexCount * 3).fill(10);
      data.hasColors = true;
      data.metadata = {
        ...(data.metadata ?? {}),
        containerFileName: 'Site.x3a',
        embeddedScanName: 'Site_0001.x3r',
      };
      visualizer.individualColorModes[0] = 'original';
      visualizer.updateFileList();

      feature.beginStationRecolor(visualizer, 'Site.x3a');
      const duringRun = visualizer.individualColorModes[0];

      // The run ends carrying transforms but no colour for this scan.
      feature.handleStationPipelineResult(visualizer, {
        summary: 'Registered 1 scan',
        updates: [{ scanName: 'Site_0001.x3r', transform: null }],
      });

      return {
        duringRun,
        afterRun: visualizer.individualColorModes[0],
        recolored: Array.from(
          (data.metadata.stationRecoloredColors as Uint8Array).slice(0, 3)
        ) as number[],
      };
    });

    expect(state.duringRun).toBe('recolored');
    // Still on the all-stations view...
    expect(state.afterRun).toBe('recolored');
    // ...showing its own station's colour rather than theblank it started as.
    expect(state.recolored).toEqual([10, 10, 10]);
  });

  test('decodes sRGB the same way the original colours are', async ({ page }) => {
    // Both modes carry sRGB camera bytes. Skipping the decode on one of them
    // renders it washed out beside the other, which is exactly how the bug
    // showed up: the colours were right, the transfer function was not.
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);

    const decode = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const data = visualizer.spatialFiles[0];
      const count = data.vertexCount;
      data.colorsArray = new Uint8Array(count * 3).fill(200);
      data.hasColors = true;
      data.metadata = {
        ...(data.metadata ?? {}),
        stationRecoloredColors: new Uint8Array(count * 3).fill(120),
      };
      visualizer.convertSrgbToLinear = true;
      const mod = (window as any).__colorMode;
      return {
        original: mod.pointColorsNeedSrgbDecode(visualizer, data, 'original'),
        recolored: mod.pointColorsNeedSrgbDecode(visualizer, data, 'recolored'),
      };
    });

    expect(decode.original).toBe(true);
    expect(decode.recolored).toBe(decode.original);
  });
});
