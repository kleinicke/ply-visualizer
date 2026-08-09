import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The archive pipeline control: it must appear only for an X3A archive inside
 * the extension, and must send the options the host expects.
 *
 * The pipeline maths is verified headlessly against the real archives; what is
 * easy to get silently wrong is this seam — a control that never renders, or a
 * message whose shape the host ignores. Both have bitten this feature before,
 * so they get a test that does not need a 400 MB fixture: a plain PLY stands in
 * for a scan, with the archive metadata the panel keys off attached to it.
 */
test.describe('Station pipeline trigger', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('stays hidden for ordinary point clouds', async ({ page }) => {
    // Even in the extension, a plain PLY is not an archive.
    await page.evaluate(() => {
      (window as any).visualizer.runningInVSCode = true;
      (window as any).visualizer.updateFileList();
    });
    await page.locator('.file-item').nth(0).locator('.registration-toggle').click();
    await expect(page.locator('.station-pipeline-run')).toHaveCount(0);
  });

  test('stays hidden for an archive outside the extension', async ({ page }) => {
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      visualizer.spatialFiles[0].metadata = {
        ...(visualizer.spatialFiles[0].metadata ?? {}),
        containerFileName: 'Stohl_1_B.x3a',
        embeddedScanName: 'Stohl_1_B_0001.x3r',
      };
      visualizer.updateFileList();
    });
    await page.locator('.file-item').nth(0).locator('.registration-toggle').click();
    await expect(page.locator('.station-pipeline-run')).toHaveCount(0);
  });

  test('appears for an archive scan and posts the pipeline options', async ({ page }) => {
    const posted = await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      visualizer.runningInVSCode = true;
      // Make file 0 look like a scan out of an X3A archive.
      visualizer.spatialFiles[0].metadata = {
        ...(visualizer.spatialFiles[0].metadata ?? {}),
        containerFileName: 'Stohl_1_B.x3a',
        embeddedScanName: 'Stohl_1_B_0001.x3r',
      };
      const sent: any[] = [];
      visualizer.vscode.postMessage = (message: any) => sent.push(message);
      (window as any).__sent = sent;
      visualizer.updateFileList();
      return true;
    });
    expect(posted).toBe(true);

    const panel = page.locator('.file-item').nth(0);
    await panel.locator('.registration-toggle').click();
    await expect(panel.locator('.station-pipeline-run')).toBeVisible();
    await expect(panel.locator('.station-pipeline-run')).toContainText('Colour scans');
    await expect(panel.locator('.station-pipeline-register')).toBeVisible();

    // Default: fill in the grey scans, leave existing colour alone.
    await panel.locator('.station-pipeline-run').click();
    let sent = await page.evaluate(() => (window as any).__sent);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('stationPipeline');
    // Colouring uses the alignment already on screen rather than re-deriving
    // it, so the request carries the viewer's transforms and no register flag.
    expect(sent[0].options).toMatchObject({
      register: false,
      colorUncolored: true,
      recolorAlreadyColored: false,
    });
    expect(sent[0].options.transforms['Stohl_1_B_0001']).toHaveLength(16);

    // The button disables itself until the host answers, so a second run
    // cannot be started on top of the first.
    await expect(panel.locator('.station-pipeline-run')).toBeDisabled();

    // The inbound half — `stationPipelineResult` coming back from the host —
    // cannot be exercised here: main.ts only installs its message listener when
    // it is really running in a webview, so a dispatched MessageEvent lands
    // nowhere. That path is covered by the extension host's own handler and by
    // the headless pipeline runs against the real archives.
  });
});
