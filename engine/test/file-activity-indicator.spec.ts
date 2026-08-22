import { test, expect } from '@playwright/test';

test('shows file activity for non-blocking loads and clears when loading finishes', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);

  const indicator = page.locator('#file-activity-indicator');
  await expect(indicator).toHaveCount(0);

  await page.evaluate(() => {
    (window as any).visualizer.showImmediateLoading({ fileName: 'activity-test.ply' });
  });
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute('aria-label', 'Loading point clouds');

  await page.evaluate(() => {
    (window as any).visualizer.showLoading(false);
  });
  await expect(indicator).toHaveCount(0);
});

test('extension activity survives geometry display and ends only on host completion', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  const indicator = page.locator('#file-activity-indicator');

  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.runningInVSCode = true;
    visualizer.showImmediateLoading({ fileName: 'large-site.x3a' });
    visualizer.showLoading(false);
  });
  await expect(indicator).toBeVisible();

  await page.evaluate(() => {
    (window as any).visualizer.completeBackgroundOperation();
  });
  await expect(indicator).toHaveCount(0);
});

test('extension activity survives chunked X3A geometry while colouring continues', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  const indicator = page.locator('#file-activity-indicator');

  await page.evaluate(async () => {
    const visualizer = (window as any).visualizer;
    visualizer.runningInVSCode = true;
    visualizer.showImmediateLoading({ fileName: 'large-station.x3a' });
    const header = {
      transferId: 'x3a-geometry',
      fileName: 'large-station.x3a',
      totalVertices: 1,
      totalChunks: 1,
      hasColors: false,
      hasNormals: false,
      useTypedArrays: true,
      scalarFieldNames: [],
      faces: [],
      format: 'binary_little_endian',
      comments: [],
      messageType: 'multiSpatialData',
    };
    visualizer.handleStartLargeFile(header);
    visualizer.handleLargeFileChunk({
      ...header,
      chunkIndex: 0,
      startIndex: 0,
      vertexCount: 1,
      positionBuffer: new Float32Array([0, 0, 0]).buffer,
      scalarFieldBuffers: {},
    });
    await visualizer.handleLargeFileComplete(header);
  });

  await expect(indicator).toBeVisible();
  await page.evaluate(() => (window as any).visualizer.completeBackgroundOperation());
  await expect(indicator).toHaveCount(0);
});

test('overlapping extension loads keep the indicator until every load completes', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  const indicator = page.locator('#file-activity-indicator');

  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.runningInVSCode = true;
    visualizer.showImmediateLoading({ fileName: 'first.ply' });
    visualizer.showImmediateLoading({ fileName: 'second.x3a' });
    visualizer.completeBackgroundOperation();
  });
  await expect(indicator).toBeVisible();

  await page.evaluate(() => (window as any).visualizer.completeBackgroundOperation());
  await expect(indicator).toHaveCount(0);
});

test('local colour changes are shown as point-cloud updates', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'activity-colour.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(
      'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n'
    ),
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);

  // Watched, not polled. A one-point cloud recolours in well under a frame, so
  // asking Playwright to *find* the indicator is a race it loses whenever the
  // machine is fast — it flaked exactly that way under full-suite load. A
  // MutationObserver installed before the action cannot miss the appearance
  // however briefly it lasts.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as any).__activitySeen = seen;
    const record = () => {
      const element = document.getElementById('file-activity-indicator');
      const label = element?.getAttribute('aria-label');
      if (label && seen[seen.length - 1] !== label) {
        seen.push(label);
      }
    };
    record();
    new MutationObserver(record).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });
  });

  await page.locator('#color-0').selectOption('1');

  await expect
    .poll(() => page.evaluate(() => (window as any).__activitySeen as string[]))
    .toContain('Updating point clouds');
  await expect(page.locator('#file-activity-indicator')).toHaveCount(0);
});

test('activity dot uses an explicit blue independent of the editor theme', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await page.evaluate(() => {
    (window as any).visualizer.showImmediateLoading({ fileName: 'blue-test.ply' });
  });
  await expect(page.locator('.activity-dot')).toHaveCSS('background-color', 'rgb(22, 140, 255)');
});
