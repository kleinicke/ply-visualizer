import { test, expect } from '@playwright/test';

const cloud = Buffer.from(
  'ply\nformat ascii 1.0\nelement vertex 4\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n0 0 1\n'
);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('#hiddenFileInput').setInputFiles(
    Array.from({ length: 8 }, (_, i) => ({
      name: `cloud-${i}.ply`,
      mimeType: 'application/octet-stream',
      buffer: cloud,
    }))
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.fileEntries.length))
    .toBe(8);
});

test('default rendering does not rebuild the mesh list per cloud or inspect the unused backend', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.stopRenderLoop();
    const getter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v), 'meshes')!.get!;
    let reads = 0;
    Object.defineProperty(v, 'meshes', {
      get() {
        reads++;
        return getter.call(v);
      },
    });
    v.getVisibilityRenderContext = () => {
      throw new Error('Unused visibility backend was inspected');
    };
    v.performRender();
    return { reads, vertices: v.spatialFiles.map((f: any) => f.vertexCount) };
  });
  // Other features may need one derived view, but never one per file.
  expect(result.reads).toBeLessThanOrEqual(2);
  expect(result.vertices).toEqual(Array(8).fill(4));
});

test('distance sizing updates both point passes without invalidating shader programs', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.stopRenderLoop();
    v.edlEnabled = false;
    v.performRender();
    const mesh = v.meshes[0];
    const round = mesh.children.find((child: any) => child.name === 'adaptive-round-pass');
    const initial = [mesh.material.version, round.material.version];
    const base = v.fileEntries.require(0).state.pointSize;
    v.screenSpaceScaling = true;
    v.camera.position.set(100, 100, 100);
    v.updateAllPointSizesForDistance();
    v.performRender();
    const scaled = [mesh.material.size, round.material.size];
    v.screenSpaceScaling = false;
    v.updateAllPointSizesForDistance();
    v.performRender();
    return {
      initial,
      final: [mesh.material.version, round.material.version],
      base,
      scaled,
      restored: [mesh.material.size, round.material.size],
      error: v.renderer.getContext().getError(),
    };
  });
  expect(result.final).toEqual(result.initial);
  expect(result.scaled[0]).toBeLessThan(result.base);
  expect(result.scaled[1]).toBe(result.scaled[0]);
  expect(result.restored).toEqual([result.base, result.base]);
  expect(result.error).toBe(0);
});
