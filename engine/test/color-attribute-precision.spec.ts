import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Intensity / field colour modes and mesh colours are stored as 16-bit
 * normalized attributes instead of floats (half the memory). That must not
 * change a single shown pixel by more than rounding: render each with the
 * 16-bit attribute, swap in the float values it encodes, render again, and
 * compare the frames.
 */
const directory = path.join(os.tmpdir(), `ply-color-precision-${process.pid}`);
const cloudFile = path.join(directory, 'intensity.ply');

test.beforeAll(() => {
  fs.mkdirSync(directory, { recursive: true });
  const rows: string[] = [];
  const side = 120;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      // A slow ramp, so the dark end of the grey map is well populated.
      rows.push(`${x / 10} ${y / 10} 0 ${(x * side + y) / (side * side)}`);
    }
  }
  fs.writeFileSync(
    cloudFile,
    'ply\nformat ascii 1.0\n' +
      `element vertex ${rows.length}\n` +
      'property float x\nproperty float y\nproperty float z\nproperty float intensity\nend_header\n' +
      rows.join('\n') +
      '\n'
  );
});

test.afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

/** Max per-channel difference: unchanged re-render, then 16-bit vs float. */
async function colourDifference(
  page: any,
  fileIndex: number
): Promise<{ noise: number; swap: number; colours: number }> {
  return page.evaluate((index: number) => {
    const visualizer = (window as any).visualizer;
    const renderer = visualizer.renderer;
    const gl = renderer.getContext() as WebGLRenderingContext;
    const grab = () => {
      renderer.render(visualizer.scene, visualizer.camera);
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
      return pixels;
    };
    const maxDiff = (a: Uint8Array, b: Uint8Array) => {
      let worst = 0;
      for (let i = 0; i < a.length; i++) {
        worst = Math.max(worst, Math.abs(a[i] - b[i]));
      }
      return worst;
    };
    const first = grab();
    // The frame must actually show the coloured cloud, not just background.
    const seen = new Set<number>();
    for (let i = 0; i < first.length; i += 4) {
      seen.add((first[i] << 16) | (first[i + 1] << 8) | first[i + 2]);
    }
    const noise = maxDiff(first, grab());
    const geometry = visualizer.meshes[index].geometry;
    const attribute = geometry.getAttribute('color');
    if (!(attribute.array instanceof Uint16Array)) {
      throw new Error(
        `expected a 16-bit colour attribute, got ${attribute.array.constructor.name}`
      );
    }
    const floats = Float32Array.from(attribute.array, (value: number) => value / 65535);
    const three = Object.getPrototypeOf(attribute).constructor;
    geometry.setAttribute('color', new three(floats, 3));
    return { noise, swap: maxDiff(first, grab()), colours: seen.size };
  }, fileIndex);
}

for (const mode of ['intensity', 'intensity-viridis']) {
  test(`${mode}: 16-bit colours render like floats`, async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.locator('#hiddenFileInput').setInputFiles(cloudFile);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 20_000 });
    await page.locator('#color-0').selectOption(mode);
    await page.waitForTimeout(500);
    const { noise, swap, colours } = await colourDifference(page, 0);
    expect(colours).toBeGreaterThan(50);
    expect(noise).toBe(0);
    expect(swap).toBeLessThanOrEqual(1);
  });
}

test('mesh colours: 16-bit linear colours render like floats', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'precision-mesh.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(
      'ply\nformat ascii 1.0\nelement vertex 4\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face 4\nproperty list uchar int vertex_indices\nend_header\n0 0 0 255 0 0\n1 0 0 0 255 0\n0 1 0 0 0 255\n0 0 1 255 255 0\n3 0 2 1\n3 0 1 3\n3 0 3 2\n3 1 2 3\n'
    ),
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(500);
  const { noise, swap, colours } = await colourDifference(page, 0);
  expect(colours).toBeGreaterThan(5);
  expect(noise).toBe(0);
  expect(swap).toBeLessThanOrEqual(1);
});
