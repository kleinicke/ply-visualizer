import { test, expect, Page } from '@playwright/test';

/** The original baseline is round; the explicit adaptive mode switches at 4 px. */

function buildSmallPly(pointCount: number): Buffer {
  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    `element vertex ${pointCount}\n` +
    'property float x\n' +
    'property float y\n' +
    'property float z\n' +
    'end_header\n';

  const body = Buffer.alloc(pointCount * 12);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < pointCount; i++) {
    body.writeFloatLE(rand() * 2 - 1, i * 12);
    body.writeFloatLE(rand() * 2 - 1, i * 12 + 4);
    body.writeFloatLE(rand() * 2 - 1, i * 12 + 8);
  }
  return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

async function loadPly(page: Page, buffer: Buffer, name: string): Promise<void> {
  await page.click('#add-file');
  await page.locator('#hiddenFileInput').setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer,
  });

  const loading = page.locator('#loading');
  if (await loading.isVisible()) {
    await expect(loading).toBeHidden({ timeout: 60000 });
  }
  await page.waitForTimeout(1000);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined, { timeout: 30000 });
});

test('the default baseline keeps the original round shader', async ({ page }) => {
  await loadPly(page, buildSmallPly(1000), 'small.ply');

  const shape = await page.evaluate(() => {
    const mesh = (window as any).visualizer.meshes[0];
    return { hasMask: mesh.material.alphaMap !== null, alphaTest: mesh.material.alphaTest };
  });

  expect(shape.hasMask).toBe(true);
  expect(shape.alphaTest).toBe(0.5);
});

test('switches to round above 4 px with downward hysteresis', async ({ page }) => {
  await loadPly(page, buildSmallPly(1000), 'small.ply');

  const shapes = await page.evaluate(async () => {
    const visualizer = (window as any).visualizer;
    visualizer.pointRenderingExperiments.applyMode('adaptive');
    const mesh = visualizer.meshes[0];
    const geometry = mesh.geometry;
    geometry.computeBoundingSphere();
    const localCenter = geometry.boundingSphere.center.clone();
    const positions = geometry.getAttribute('position');
    // Keep every point at one depth so this test isolates the exact cutoff;
    // representative depth selection is covered by projected-point-shape.spec.
    for (let index = 0; index < positions.count; index++) {
      positions.setXYZ(index, localCenter.x, localCenter.y, localCenter.z);
    }
    positions.needsUpdate = true;
    visualizer.camera.updateMatrixWorld();
    mesh.updateWorldMatrix(true, false);
    const center = localCenter
      .clone()
      .applyMatrix4(mesh.matrixWorld)
      .applyMatrix4(visualizer.camera.matrixWorldInverse);
    const scale = visualizer.renderer.domElement.height * 0.5;
    const sizeForPixels = (pixels: number) => (pixels * -center.z) / scale;
    const apply = async (pixels: number) => {
      mesh.material.size = sizeForPixels(pixels);
      visualizer.requestRender();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { hasMask: mesh.material.alphaMap !== null, alphaTest: mesh.material.alphaTest };
    };
    return {
      belowThreshold: await apply(3.9),
      aboveFour: await apply(4.1),
      hysteresis: await apply(3.8),
      belowBand: await apply(3.4),
    };
  });

  expect(shapes.belowThreshold).toEqual({ hasMask: false, alphaTest: 0 });
  expect(shapes.aboveFour).toEqual({ hasMask: true, alphaTest: 0.5 });
  expect(shapes.hysteresis).toEqual({ hasMask: true, alphaTest: 0.5 });
  expect(shapes.belowBand).toEqual({ hasMask: false, alphaTest: 0 });
});
