import { test, expect } from '@playwright/test';

test('restoring a lost context waits for explicit resume before uploading the scene', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'recovery.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(
      'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n'
    ),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(1);
  await page.evaluate(() => {
    const w = window as any;
    const gl = w.visualizer.renderer.getContext();
    w.recoveryUploads = 0;
    const upload = gl.bufferData.bind(gl);
    gl.bufferData = (...args: any[]) => {
      w.recoveryUploads++;
      return upload(...args);
    };
    w.loseContextExtension = gl.getExtension('WEBGL_lose_context');
    if (!w.loseContextExtension) {
      throw new Error('Context-loss test requires WEBGL_lose_context');
    }
    w.loseContextExtension.loseContext();
  });
  const banner = page.getByRole('alert', { name: 'GPU recovery' });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('button')).toBeDisabled();
  await page.evaluate(() => (window as any).loseContextExtension.restoreContext());
  await expect(banner.getByRole('button')).toBeEnabled();
  // Explicit render requests cannot bypass the pause, even after restoration.
  await page.evaluate(() => {
    const w = window as any;
    for (let i = 0; i < 10; i++) {
      w.visualizer.performRender();
    }
  });
  expect(await page.evaluate(() => (window as any).recoveryUploads)).toBe(0);
  await banner.getByRole('button').click();
  await expect(banner).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).recoveryUploads)).toBeGreaterThan(0);
  // A second reset pauses again; files remain removable while paused.
  await page.evaluate(() => (window as any).loseContextExtension.loseContext());
  await expect(banner).toBeVisible();
  await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
  expect(await page.evaluate(() => (window as any).visualizer.spatialFiles.length)).toBe(0);
  await page.evaluate(() => (window as any).loseContextExtension.restoreContext());
  await expect(banner.getByRole('button')).toBeEnabled();
  await banner.getByRole('button').click();
  await expect(banner).toBeHidden();
  expect(
    await page.evaluate(() => (window as any).visualizer.renderer.getContext().isContextLost())
  ).toBe(false);
});

test('removal releases unused WebGPU buffers and retains the remaining hidden cloud', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  const available = await page.evaluate(async () => {
    const v = (window as any).visualizer;
    await v.webgpuReady;
    return !!v.selectionManager.webgpuPicker && !!v.webgpuVisibilityRenderer;
  });
  test.skip(!available, 'Requires a working WebGPU adapter');
  await page.locator('#hiddenFileInput').setInputFiles(
    [0, 1].map(i => ({
      name: `buffers-${i}.ply`,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(
        'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n'
      ),
    }))
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(2);
  const result = await page.evaluate(async () => {
    const v = (window as any).visualizer;
    v.stopRenderLoop();
    const picker = v.selectionManager.webgpuPicker;
    const visibility = v.webgpuVisibilityRenderer;
    v.selectionManager.updateContext(v.getSelectionContext());
    await picker.pick(100, 100, v.renderer.domElement, v.meshes, v.selectionManager.context);
    for (const mesh of v.meshes) {
      mesh.material.sizeAttenuation = false;
      mesh.material.size = 1;
      mesh.material.transparent = false;
      mesh.material.opacity = 1;
    }
    const rendered = visibility.render(v.getVisibilityRenderContext());
    await visibility.device.queue.onSubmittedWorkDone();
    visibility.setEnabled(false);
    const before = [picker.ownedPositionBuffers.size, visibility.ownedBuffers.size];
    v.fileEntries.require(1).state.visible = false;
    v.removeFileByIndex(0);
    const remaining = [picker.ownedPositionBuffers.size, visibility.ownedBuffers.size];
    v.removeFileByIndex(0);
    return {
      rendered,
      before,
      remaining,
      after: [picker.ownedPositionBuffers.size, visibility.ownedBuffers.size],
    };
  });
  expect(result.rendered).toBe(true);
  expect(result.before).toEqual([2, 4]);
  expect(result.remaining).toEqual([1, 2]);
  expect(result.after).toEqual([0, 0]);
});

test('a hidden viewer releases its context and silently restores the scene when shown', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'hidden.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(
      'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n'
    ),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(1);
  await page.clock.install();
  const lost = () =>
    page.evaluate(() => (window as any).visualizer.renderer.getContext().isContextLost());
  await page.evaluate(() => {
    const w = window as any;
    const gl = w.visualizer.renderer.getContext();
    w.hiddenUploads = 0;
    const upload = gl.bufferData.bind(gl);
    gl.bufferData = (...args: any[]) => {
      w.hiddenUploads++;
      return upload(...args);
    };
    w.visualizer.gpuResidency.setHidden(true);
  });
  // A quick tab switch keeps the context.
  await page.clock.runFor(5_000);
  expect(await lost()).toBe(false);
  await page.clock.runFor(6_000);
  expect(await lost()).toBe(true);
  const banner = page.getByRole('alert', { name: 'GPU recovery' });
  await expect(banner).toBeHidden();

  await page.evaluate(() => (window as any).visualizer.gpuResidency.setHidden(false));
  await expect.poll(lost).toBe(false);
  await page.clock.runFor(100);
  await expect.poll(() => page.evaluate(() => (window as any).hiddenUploads)).toBeGreaterThan(0);
  await expect(banner).toBeHidden();

  // Work that needs the GPU while hidden (agent capture) brings it back first.
  await page.evaluate(() => (window as any).visualizer.gpuResidency.setHidden(true));
  await page.clock.runFor(11_000);
  expect(await lost()).toBe(true);
  await page.evaluate(() => (window as any).visualizer.gpuResidency.ensureResident());
  expect(await lost()).toBe(false);
  await expect(banner).toBeHidden();
});

const uniformGrid = () => {
  const rows = Array.from({ length: 40 * 40 }, (_, i) => {
    const x = (i % 40) / 10;
    const y = Math.floor(i / 40) / 10;
    return `${x} ${y} ${(Math.sin(x * 3) * Math.cos(y * 2)) / 4}`;
  });
  return Buffer.from(
    `ply\nformat ascii 1.0\nelement vertex ${rows.length}\n` +
      'property float x\nproperty float y\nproperty float z\nend_header\n' +
      rows.join('\n') +
      '\n'
  );
};

test('a hidden viewer keeps its context while releasing it would lose splat state', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'guarded.ply',
    mimeType: 'application/octet-stream',
    buffer: uniformGrid(),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(1);
  await page.clock.install();
  const lost = () =>
    page.evaluate(() => (window as any).visualizer.renderer.getContext().isContextLost());
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.fileEntries.require(0).state.splatModeActive = true;
    v.gpuResidency.setHidden(true);
  });
  await page.clock.runFor(25_000);
  expect(await lost()).toBe(false);
  // Once nothing stands in the way, the retried release goes ahead.
  await page.evaluate(() => {
    (window as any).visualizer.fileEntries.require(0).state.splatModeActive = false;
  });
  await page.clock.runFor(11_000);
  expect(await lost()).toBe(true);
});

test('an EDL-shaded viewer redraws the same frame after a hidden release', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  // No per-point colour, so Auto EDL and its render targets are in use.
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'uniform.ply',
    mimeType: 'application/octet-stream',
    buffer: uniformGrid(),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(1);
  const frame = () =>
    page.evaluate(() => {
      const v = (window as any).visualizer;
      v.stopRenderLoop();
      v.updatePointSize(0, 0.05);
      v.performRender();
      const gl = v.renderer.getContext();
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      let hash = 0;
      for (let i = 0; i < pixels.length; i++) {
        hash = (hash * 31 + pixels[i]) | 0;
      }
      return { hash, edlClouds: v.edlPass?.eligibleObjectCount };
    });
  const before = await frame();
  expect(before.edlClouds).toBe(1);
  await page.clock.install();
  const lost = () =>
    page.evaluate(() => (window as any).visualizer.renderer.getContext().isContextLost());
  await page.evaluate(() => (window as any).visualizer.gpuResidency.setHidden(true));
  await page.clock.runFor(11_000);
  expect(await lost()).toBe(true);
  await page.evaluate(() => (window as any).visualizer.gpuResidency.setHidden(false));
  await expect.poll(lost).toBe(false);
  await page.clock.runFor(100);
  expect(await frame()).toEqual(before);
});
