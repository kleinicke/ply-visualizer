import { test, expect, Page } from '@playwright/test';

/**
 * MSAA is off by default. The depth test runs per sample, so a multisampled
 * context multiplies exactly the work that dominates zoomed-out point clouds —
 * where millions of points collapse onto a few pixels and their depth tests
 * serialize on the same addresses. It smooths nothing on 1-pixel points.
 *
 * `antialias` is a context-creation flag and cannot be toggled at runtime, so
 * `?antialias=1` exists to compare both configurations on one build.
 */

async function contextAntialiasing(page: Page, query: string) {
  await page.goto(`/3d-visualizer/${query}`);
  await page.waitForFunction(() => (window as any).visualizer !== undefined, { timeout: 30000 });
  return page.evaluate(() => {
    const gl = (window as any).visualizer.renderer.getContext();
    return {
      samples: gl.getParameter(gl.SAMPLES) as number,
      requested: gl.getContextAttributes().antialias as boolean,
    };
  });
}

test('the default context is not multisampled', async ({ page }) => {
  const context = await contextAntialiasing(page, '');
  expect(context.requested).toBe(false);
  expect(context.samples).toBe(0);
});

test('?antialias=1 brings MSAA back for comparison', async ({ page }) => {
  const context = await contextAntialiasing(page, '?antialias=1');
  expect(context.requested).toBe(true);
  expect(context.samples).toBeGreaterThan(1);
});
