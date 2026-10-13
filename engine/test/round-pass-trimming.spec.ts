import { test, expect } from '@playwright/test';

// A ground plane receding from the camera, stored row by row like a depth
// image: near rows need round discs, far rows stay below the threshold. Large
// enough (655,360 points) that the round pass is trimmed per chunk.
function groundPlane(): Buffer {
  const columns = 1024;
  const rows = 640;
  const header = Buffer.from(
    `ply\nformat binary_little_endian 1.0\nelement vertex ${columns * rows}\n` +
      'property float x\nproperty float y\nproperty float z\n' +
      'property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n'
  );
  const body = Buffer.alloc(columns * rows * 15);
  let offset = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      body.writeFloatLE((column - columns / 2) * 0.02, offset);
      body.writeFloatLE(0, offset + 4);
      body.writeFloatLE(-row * 0.05, offset + 8);
      body.writeUInt8((column * 7) % 256, offset + 12);
      body.writeUInt8((row * 3) % 256, offset + 13);
      body.writeUInt8(200, offset + 14);
      offset += 15;
    }
  }
  return Buffer.concat([header, body]);
}

test('the round pass draws only chunks that can reach the disc size, with identical pixels', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'ground.ply',
    mimeType: 'application/octet-stream',
    buffer: groundPlane(),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length), {
      timeout: 30_000,
    })
    .toBe(1);

  const frame = () =>
    page.evaluate(() => {
      const v = (window as any).visualizer;
      v.stopRenderLoop();
      v.updatePointSize(0, 0.02);
      // A posed cloud, so the chunk depths go through its world matrix.
      v.meshes[0].rotation.set(0.05, 0.3, 0);
      v.meshes[0].position.set(0.4, -0.1, 0.2);
      v.camera.position.set(0, 1, 2);
      v.camera.lookAt(0, 0, -10);
      v.camera.updateMatrixWorld();
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
      const mesh = v.meshes[0];
      const round = mesh.children.find((child: any) => child.name === 'adaptive-round-pass');
      return {
        hash,
        square: mesh.material.visible,
        round: round.visible,
        roundCount: round.geometry.drawRange.count,
        total: mesh.geometry.getAttribute('position').count,
      };
    });

  // Chunk bounds are computed in background slices after the first frame and
  // must finish without further frames - a static scene's loop is asleep -
  // then ask for the frame that uses them.
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.requestRender = () => {
      v.renderRequestsForTest = (v.renderRequestsForTest ?? 0) + 1;
    };
  });
  await frame();
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.renderRequestsForTest ?? 0), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  const trimmed = await frame();
  expect(trimmed.round).toBe(true);
  expect(trimmed.roundCount).toBeLessThan(trimmed.total);
  expect(trimmed.square).toBe(true);

  await page.evaluate(() => {
    const renderer = (window as any).visualizer.adaptivePointRenderer;
    // Both passes over every point: the reference the skips must match.
    renderer.pixelRange = () => [0, Infinity];
    renderer.limitRoundRange = (source: any, view: any) => {
      view.roundGeometry.setDrawRange(
        source.geometry.drawRange.start,
        source.geometry.drawRange.count
      );
      return true;
    };
  });
  const full = await frame();
  expect(full.roundCount).toBeGreaterThanOrEqual(full.total);
  expect(trimmed.hash).toBe(full.hash);
});
