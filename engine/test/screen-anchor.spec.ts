import { expect, test } from '@playwright/test';

test('the target uses the center of the visible viewport when browser chrome is shown', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).visualizer?.screenAnchor));

  const result = await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    const panel = document.getElementById('main-ui-panel')!;
    panel.style.display = 'none';
    viewer.screenAnchor.refreshAutomatic(true, {
      offsetLeft: 0,
      offsetTop: 100,
      width: 390,
      height: 600,
    });
    const safe = viewer.screenAnchor.getSafeRect();
    const canvas = viewer.renderer.domElement.getBoundingClientRect();
    const projected = viewer.controls.target.clone().project(viewer.camera);
    return {
      safe,
      canvasHeight: canvas.height,
      targetY: ((1 - projected.y) / 2) * canvas.height,
    };
  });

  expect(result.safe).toEqual({ x: 0, y: 100, width: 390, height: 600 });
  expect(result.targetY).toBeCloseTo(400, 1);
  expect(result.targetY).not.toBeCloseTo(result.canvasHeight / 2 + 100, 1);
});

test('the target projects into the panel-aware safe area', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).visualizer?.screenAnchor));

  // Establish a known collapsed state regardless of the persisted/default tab.
  if ((await page.locator('[data-tab="files"]').getAttribute('aria-pressed')) === 'true') {
    await page.click('[data-tab="files"]');
  }
  await page.click('[data-tab="files"]');
  await page.waitForTimeout(100);
  const expanded = await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    viewer.screenAnchor.refreshAutomatic(true);
    const safe = viewer.screenAnchor.getSafeRect();
    const canvas = viewer.renderer.domElement.getBoundingClientRect();
    const projected = viewer.controls.target.clone().project(viewer.camera);
    return {
      safe,
      targetX: ((projected.x + 1) / 2) * canvas.width,
      targetY: ((1 - projected.y) / 2) * canvas.height,
      panelBottom:
        document.getElementById('main-ui-panel')!.getBoundingClientRect().bottom - canvas.top,
      displacement: Math.hypot(
        safe.x + safe.width / 2 - canvas.width / 2,
        safe.y + safe.height / 2 - canvas.height / 2
      ),
    };
  });

  await page.click('[data-tab="files"]');
  await page.waitForTimeout(100);
  const compact = await page.evaluate(() => {
    const viewer: any = (window as any).visualizer;
    viewer.screenAnchor.refreshAutomatic(true);
    const safe = viewer.screenAnchor.getSafeRect();
    const canvas = viewer.renderer.domElement.getBoundingClientRect();
    return {
      safe,
      displacement: Math.hypot(
        safe.x + safe.width / 2 - canvas.width / 2,
        safe.y + safe.height / 2 - canvas.height / 2
      ),
    };
  });

  expect(expanded.safe.y).toBeGreaterThanOrEqual(expanded.panelBottom);
  expect(expanded.targetX).toBeCloseTo(expanded.safe.x + expanded.safe.width / 2, 1);
  expect(expanded.targetY).toBeCloseTo(expanded.safe.y + expanded.safe.height / 2, 1);
  expect(expanded.displacement).toBeGreaterThan(compact.displacement);
});
