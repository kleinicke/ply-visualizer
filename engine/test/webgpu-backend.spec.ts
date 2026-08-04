import { test, expect } from '@playwright/test';

/**
 * The WebGPU backend is opt-in (`?webgpu=1`) and falls back to WebGL whenever
 * WebGPU cannot start. Headless Chromium often has no WebGPU adapter, so these
 * tests assert the *contract* — one of the two backends comes up, and the
 * viewer renders either way — rather than requiring WebGPU to be present.
 * `webgpu-backend.spec.ts` is therefore useful in CI as a no-regression check
 * on the fallback path, and useful locally as a smoke test of the real thing.
 */

async function bootBackend(page: import('@playwright/test').Page, query: string) {
  await page.goto(`/3d-visualizer/${query}`);
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(() => (window as any).visualizer?.renderer !== undefined);
  return page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return {
      backend: visualizer.rendererBackend as string,
      hasWebglRenderer: visualizer.webglRenderer !== null,
      canvasWidth: visualizer.renderer.domElement.width as number,
    };
  });
}

test('default boot uses the WebGL backend', async ({ page }) => {
  const result = await bootBackend(page, '');
  expect(result.backend).toBe('webgl');
  expect(result.hasWebglRenderer).toBe(true);
  expect(result.canvasWidth).toBeGreaterThan(0);
});

test('?webgpu=1 starts WebGPU, or falls back to a working WebGL viewer', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', message => {
    if (message.type() === 'warning') {
      warnings.push(message.text());
    }
  });

  const result = await bootBackend(page, '?webgpu=1');
  expect(['webgpu', 'webgl']).toContain(result.backend);
  // The concrete WebGL renderer is what EDL and Spark test for, so it must be
  // present exactly when the backend is WebGL.
  expect(result.hasWebglRenderer).toBe(result.backend === 'webgl');
  expect(result.canvasWidth).toBeGreaterThan(0);

  if (result.backend === 'webgl') {
    // A fallback must say why; a silent one would make a "WebGPU" measurement
    // secretly a WebGL measurement.
    expect(warnings.some(text => text.includes('Falling back to WebGL'))).toBe(true);
  }
});

test('the WebGPU backend disables the WebGL-only features rather than breaking', async ({
  page,
}) => {
  await page.goto('/3d-visualizer/?webgpu=1');
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(() => (window as any).visualizer?.renderer !== undefined);

  const state = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return {
      backend: visualizer.rendererBackend as string,
      edlComposer: visualizer.effectComposer !== null,
      edlEnabled: visualizer.edlEnabled as boolean,
    };
  });

  if (state.backend !== 'webgpu') {
    test.skip(true, 'No WebGPU adapter in this environment');
    return;
  }
  // EDL is an EffectComposer/GLSL pass with no WebGPU implementation.
  expect(state.edlComposer).toBe(false);
  expect(state.edlEnabled).toBe(false);
});
