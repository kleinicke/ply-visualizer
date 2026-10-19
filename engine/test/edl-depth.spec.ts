import { test, expect } from '@playwright/test';

/** Depth clouds start white for Auto EDL; generated grayscale remains selectable. */
for (const closeUp of [false, true]) {
  test(`depth clouds retain white defaults and grayscale with ${closeUp ? 'close-up' : 'normal-scale'} EDL`, async ({
    page,
  }) => {
    const width = 160,
      height = 120;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pixels.writeFloatLE(x < width / 2 ? 2 : 3 + 0.3 * Math.sin(y / 10), (y * width + x) * 4);
      }
    }
    const buffer = Buffer.concat([Buffer.from(`Pf\n${width} ${height}\n-1.0\n`), pixels]);
    await page.goto('/');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles({ name: 'edl-depth.pfm', mimeType: 'application/octet-stream', buffer });
    await expect(page.locator('#depth-ok')).toBeVisible();
    await page.locator('#depth-fx').fill('140');
    await page.locator('#depth-ok').click();
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
    if (closeUp) {
      const depthRange = await page.evaluate(() => {
        const v = (window as any).visualizer,
          c = v.camera;
        v.meshes[0].scale.multiplyScalar(0.01);
        c.position.multiplyScalar(0.01);
        v.controls.target.multiplyScalar(0.01);
        c.updateMatrixWorld();
        v.meshes[0].updateMatrixWorld();
        const a = v.meshes[0].geometry.attributes.position;
        const p = c.position.clone();
        let min = Infinity,
          max = 0;
        for (let i = 0; i < a.count; i++) {
          p.fromBufferAttribute(a, i)
            .applyMatrix4(v.meshes[0].matrixWorld)
            .applyMatrix4(c.matrixWorldInverse);
          min = Math.min(min, -p.z);
          max = Math.max(max, -p.z);
        }
        return { min, max, near: c.near };
      });
      expect(depthRange.min).toBeGreaterThan(depthRange.near);
      expect(depthRange.max).toBeLessThan(0.1);
    }
    const frame = (mode: string) =>
      page.evaluate(mode => {
        const v = (window as any).visualizer;
        v.stopRenderLoop();
        v.edlMode = mode;
        v.edlEnabled = mode !== 'off';
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
          eligible: v.edlPass.eligibleObjectCount,
          color: v.fileEntries.require(0).state.colorMode,
        };
      }, mode);
    const auto = await frame('auto');
    const off = await frame('off');
    const all = await frame('all');
    expect(auto.color).toBe('0');
    expect(auto.eligible).toBe(1);
    expect(auto.hash).toBe(all.hash);
    expect(auto.hash).not.toBe(off.hash);
    await expect(page.locator('#color-0')).toHaveValue('0');
    await expect(page.locator('#color-0 option[value="original"]')).toHaveText('Depth (grayscale)');
    await page.locator('#color-0').selectOption('original');
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).visualizer.fileEntries.require(0).state.colorMode)
      )
      .toBe('original');
    const grayAuto = await frame('auto');
    const grayOff = await frame('off');
    expect(grayAuto.color).toBe('original');
    expect(grayAuto.eligible).toBe(0);
    expect(grayAuto.hash).toBe(grayOff.hash);
    expect(grayOff.hash).not.toBe(off.hash);
    await page.evaluate(() => (window as any).visualizer.onFileColorModeChange(0, '0'));
    const flatAuto = await frame('auto');
    const flatAll = await frame('all');
    const flatOff = await frame('off');
    expect(flatAuto.eligible).toBe(1);
    expect(flatAuto.hash).toBe(flatAll.hash);
    expect(flatAuto.hash).not.toBe(flatOff.hash);
    // A second cloud must also be white, not its assigned palette colour.
    await page.evaluate(() => {
      const v = (window as any).visualizer;
      v.addNewFiles([{ ...v.spatialFiles[0], fileName: 'second-depth.pfm' }]);
    });
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await expect(page.locator('#color-1')).toHaveValue('0');
    expect(
      await page.evaluate(() => {
        const v = (window as any).visualizer;
        return v.meshes[1].material.color.getHex();
      })
    ).toBe(0xffffff);
  });
}
