import { test, expect, type Page } from '@playwright/test';
import {
  SMALL_VIEW_HIDE_COVERAGE,
  SMALL_VIEW_SHOW_COVERAGE,
  shouldShowSmallView,
} from '../src/smallViewThresholds';

function pointCloud(pointCount = 1_000): Buffer {
  const header = Buffer.from(
    `ply\nformat binary_little_endian 1.0\nelement vertex ${pointCount}\n` +
      'property float x\nproperty float y\nproperty float z\nend_header\n'
  );
  const body = Buffer.alloc(pointCount * 12);
  for (let index = 0; index < pointCount; index++) {
    const angle = (index / pointCount) * Math.PI * 2;
    body.writeFloatLE(Math.cos(angle), index * 12);
    body.writeFloatLE(Math.sin(angle), index * 12 + 4);
    body.writeFloatLE(((index % 31) / 30) * 2 - 1, index * 12 + 8);
  }
  return Buffer.concat([header, body]);
}

async function loadCloud(page: Page): Promise<void> {
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'small-view.ply',
    mimeType: 'application/octet-stream',
    buffer: pointCloud(),
  });
  await page.waitForFunction(() => (window as any).visualizer?.meshes?.length === 1);
}

async function pullFarBack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const target = visualizer.controls.target.clone();
    const offset = visualizer.camera.position.clone().sub(target).multiplyScalar(12);
    visualizer.camera.position.copy(target).add(offset);
    visualizer.camera.lookAt(target);
    visualizer.controls.update();
    visualizer.requestRender();
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
});

test('uses a narrow 0.5%-to-0.75% visibility hysteresis', () => {
  expect(shouldShowSmallView(SMALL_VIEW_SHOW_COVERAGE - 0.0001, false)).toBe(true);
  expect(shouldShowSmallView(0.006, false)).toBe(false);
  expect(shouldShowSmallView(0.006, true)).toBe(true);
  expect(shouldShowSmallView(SMALL_VIEW_HIDE_COVERAGE + 0.0001, true)).toBe(false);
});

test('uses the fixed clipping range', async ({ page }) => {
  await loadCloud(page);
  expect(
    await page.evaluate(() => {
      const camera = (window as any).visualizer.camera;
      return { near: camera.near, far: camera.far };
    })
  ).toEqual({ near: 0.001, far: 10_000_000 });
});

test('offers a standalone fit button for a compact distant cloud', async ({ page }) => {
  await loadCloud(page);
  await expect(page.locator('#small-view-affordance')).toHaveCount(0);

  await pullFarBack(page);
  const prompt = page.locator('#small-view-affordance');
  await expect(prompt).toBeVisible({ timeout: 2_000 });
  await expect(prompt).not.toContainText('Points very small');
  await expect(page.locator('#main-ui-panel > #small-view-affordance-mount')).toHaveCount(0);
  await expect(page.locator('#small-view-fit')).toHaveText(/Fit to View/);
  const placement = await page.evaluate(() => {
    const panel = document.getElementById('main-ui-panel')!.getBoundingClientRect();
    const button = document.getElementById('small-view-fit')!.getBoundingClientRect();
    return {
      below: button.top >= panel.bottom + 7,
      sameWidth: Math.abs(button.width - panel.width) < 1,
      radius: getComputedStyle(document.getElementById('small-view-fit')!).borderRadius,
    };
  });
  expect(placement).toEqual({ below: true, sameWidth: true, radius: '6px' });

  const farDistance = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return visualizer.camera.position.distanceTo(visualizer.controls.target);
  });
  await page.locator('#small-view-fit').click();
  await expect(prompt).toHaveCount(0);
  const fittedDistance = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return visualizer.camera.position.distanceTo(visualizer.controls.target);
  });
  expect(fittedDistance).toBeLessThan(farDistance);
});

test('does not prompt for a sparse cloud surrounding the camera', async ({ page }) => {
  await loadCloud(page);
  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.camera.position.set(0, 0, 0);
    visualizer.camera.lookAt(0, 0, -1);
    visualizer.controls.target.set(0, 0, -1);
    visualizer.controls.update();
    visualizer.requestRender();
  });
  await page.waitForTimeout(700);
  await expect(page.locator('#small-view-affordance')).toHaveCount(0);
});

test('does not prompt when all point clouds are intentionally hidden', async ({ page }) => {
  await loadCloud(page);
  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.fileVisibility[0] = false;
    visualizer.meshes[0].visible = false;
  });
  await pullFarBack(page);
  await page.waitForTimeout(700);
  await expect(page.locator('#small-view-affordance')).toHaveCount(0);
});
