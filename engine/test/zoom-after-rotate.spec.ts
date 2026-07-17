import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Zoom must keep working correctly right after a rotation, in both trackball
// schemes. (Historic regression: an earlier inverse-trackball patch kept a
// shadow eye vector that silently fought post-rotation zoom. That patch is
// gone, but the interaction stays covered for the current schemes.)

async function setup(page: Page, mode: 'ball' | 'legacy') {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);
  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(1500);
  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);
  // Click the scheme button explicitly — never rely on the startup default.
  await page.click(mode === 'legacy' ? '#legacy-trackball-controls' : '#trackball-controls');
  await page.waitForTimeout(300);
}

for (const mode of ['ball', 'legacy'] as const) {
  test(`${mode} trackball: zoom still works correctly after rotating`, async ({ page }) => {
    await setup(page, mode);

    const canvas = page.locator('#three-canvas');
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const getDist = () =>
      page.evaluate(() => {
        const v: any = (window as any).visualizer;
        return v.camera.position.distanceTo(v.controls.target);
      });

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 4; i++) {
      await page.mouse.move(cx + i * 5, cy, { steps: 1 });
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);

    const distBeforeZoom = await getDist();

    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(300);
    const distAfterZoom = await getDist();

    console.log(`[${mode}] distBeforeZoom=${distBeforeZoom} distAfterZoom=${distAfterZoom}`);
    expect(distAfterZoom).toBeLessThan(distBeforeZoom * 0.95);

    // The zoom must stick — nothing may silently revert it afterwards.
    await page.waitForTimeout(300);
    const distAfterSettle = await getDist();
    expect(Math.abs(distAfterSettle - distAfterZoom)).toBeLessThan(distAfterZoom * 0.2);
  });
}
