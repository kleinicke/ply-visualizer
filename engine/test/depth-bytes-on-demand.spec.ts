import { test, expect } from '@playwright/test';

/**
 * A depth image the viewer can read again (VS Code serves it at a webview URI)
 * is not kept in memory for as long as it is open: settings changes are
 * served from the depth worker's decoded copy, and only when the worker no
 * longer has it is the file read again.
 */
function planePfm(width: number, height: number): Buffer {
  const header = Buffer.from(`Pf\n${width} ${height}\n-1.0\n`, 'ascii');
  const values = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    values.writeFloatLE(1 + (i % width) / width, i * 4);
  }
  return Buffer.concat([header, values]);
}

test('a depth image opened from a URI is read again on demand, not held', async ({ page }) => {
  const pfm = planePfm(64, 48);
  let reads = 0;
  await page.route('**/__depth/plane.pfm', route => {
    reads++;
    return route.fulfill({ body: pfm, contentType: 'application/octet-stream' });
  });
  // The VS Code host: it answers the request for camera parameters.
  await page.addInitScript(() => {
    (window as any).acquireVsCodeApi = () => ({
      postMessage(message: any) {
        if (message?.type === 'requestCameraParams') {
          setTimeout(() =>
            window.postMessage(
              {
                type: 'cameraParams',
                requestId: message.requestId,
                fx: 50,
                cameraModel: 'pinhole-opencv',
                depthType: 'euclidean',
              },
              '*'
            )
          );
        }
      },
      getState: () => ({}),
      setState() {},
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page.evaluate(() =>
    window.postMessage(
      { type: 'depthData', fileUri: `${location.origin}/__depth/plane.pfm`, fileName: 'plane.pfm' },
      '*'
    )
  );
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 15000 });
  expect(reads).toBe(1);

  const state = () =>
    page.evaluate(() => {
      const data = (window as any).visualizer.spatialFiles[0];
      return {
        held: data.depthSource.originalData instanceof ArrayBuffer,
        points: data.vertexCount,
      };
    });
  const opened = await state();
  expect(opened.held).toBe(false);
  expect(opened.points).toBeGreaterThan(0);

  const reapply = () => page.evaluate(() => (window as any).visualizer.applyDepthSettings(0));
  // The worker still has the decoded image: nothing is read.
  await reapply();
  expect(reads).toBe(1);

  // Once the worker has lost it, the file is read again and gives the same cloud.
  await page.evaluate(() => (window as any).visualizer.depthWorkerClient.resetWorker());
  await reapply();
  expect(reads).toBe(2);
  expect(await state()).toEqual(opened);
});

test('a picked depth image uses the distortion coefficients from the dialog', async ({ page }) => {
  const project = async (coefficients: string) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
    await page.locator('#hiddenFileInput').setInputFiles({
      name: 'plane.pfm',
      mimeType: 'application/octet-stream',
      buffer: planePfm(64, 48),
    });
    // A short focal length puts the corners far from the centre.
    await page.locator('#depth-fx').fill('40');
    await page.locator('#camera-coefficients').fill(coefficients);
    await page.locator('#depth-ok').click();
    await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 15000 });
    return page.evaluate(() =>
      Array.from(
        (window as any).visualizer.spatialFiles[0].positionsArray.subarray(0, 3) as Float32Array
      )
    );
  };
  const ideal = await project('0,0,0,0,0,0,0,0,0,0,0,0,0,0');
  const distorted = await project('0.1,0,0,0,0,0,0,0,0,0,0,0,0,0');
  // The first point is a corner pixel, where k1 moves it most.
  expect(Math.abs(distorted[0] - ideal[0])).toBeGreaterThan(1e-2);
});
