import { test, expect } from '@playwright/test';

test('EDL automatically uses reversed depth with a safe fallback and restores camera state', async ({
  page,
}) => {
  const width = 160,
    height = 120;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.writeFloatLE(1000 + x * 0.2 + y * 0.3, (y * width + x) * 4);
    }
  }
  await page.goto('/');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'precision.pfm',
    mimeType: 'application/octet-stream',
    buffer: Buffer.concat([Buffer.from(`Pf\n${width} ${height}\n-1.0\n`), pixels]),
  });
  await page.locator('#depth-fx').fill('140');
  await page.locator('#depth-ok').click();
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  await page.locator('[data-tab="controls"]').click();
  await expect(page.locator('#edl-depth-mode')).toHaveCount(0);
  const supported = await page.evaluate(() =>
    (window as any).visualizer.webglRenderer.extensions.has('EXT_clip_control')
  );
  const frame = () =>
    page.evaluate(() => {
      const v = (window as any).visualizer;
      v.stopRenderLoop();
      const projection = v.camera.projectionMatrix.toArray();
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
      for (const value of pixels) {
        hash = (hash * 31 + value) | 0;
      }
      return {
        hash,
        usesReversed: v.edlPass.edlMaterial.uniforms.reversedDepth.value,
        near: v.camera.near,
        far: v.camera.far,
        projection,
        after: v.camera.projectionMatrix.toArray(),
        reversed: v.camera.reversedDepth,
        rendererReversed: v.renderer.state.buffers.depth.getReversed(),
        error: gl.getError(),
      };
    });
  const reversed = await frame();
  expect(reversed.usesReversed).toBe(supported);
  expect(reversed.near).toBe(0.001);
  expect(reversed.far).toBe(10000000);
  expect(reversed.after).toEqual(reversed.projection);
  expect(reversed.reversed).toBe(false);
  expect(reversed.rendererReversed).toBe(false);
  expect(reversed.error).toBe(0);
  // A runtime fallback must render correctly too (e.g. a restored context).
  await page.evaluate(() => {
    const v = (window as any).visualizer,
      ext = v.renderer.extensions;
    const has = ext.has.bind(ext);
    (window as any).originalExtensionHas = has;
    ext.has = (name: string) => (name === 'EXT_clip_control' ? false : has(name));
  });
  const fallback = await frame();
  expect(fallback.usesReversed).toBe(false);
  expect(fallback.error).toBe(0);
  if (supported) {
    expect(fallback.hash).not.toBe(reversed.hash);
  }
  await page.evaluate(() => {
    (window as any).visualizer.renderer.extensions.has = (window as any).originalExtensionHas;
  });
  expect((await frame()).hash).toBe(reversed.hash);
  // A coloured cloud closer to the camera must mask a uniform cloud even at
  // distances where conventional depth loses precision. Preserve its projection.
  await page.evaluate(async () => {
    const v = (window as any).visualizer;
    const camera = v.camera.position.clone(),
      target = v.controls.target.clone();
    v.addNewFiles([{ ...v.spatialFiles[0], fileName: 'foreground.pfm' }]);
    v.camera.position.copy(camera);
    v.controls.target.copy(target);
    v.camera.updateMatrixWorld();
    v.meshes[1].scale.setScalar(0.99);
    v.meshes[1].position.copy(camera).multiplyScalar(0.01);
    await v.onFileColorModeChange(1, 'original');
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).visualizer.fileEntries.require(1).state.colorMode)
    )
    .toBe('original');
  const masked = await frame();
  expect(await page.evaluate(() => (window as any).visualizer.edlPass.eligibleObjectCount)).toBe(1);
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.edlPass.edlStrength = 0;
  });
  expect((await frame()).hash).toBe(masked.hash);
});
