import { test, expect } from '@playwright/test';
import path from 'path';

test('inverse-trackball: zoom still works correctly after rotating', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);
  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(1500);
  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);
  await page.click('#inverse-trackball-controls');
  await page.waitForTimeout(300);

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

  console.log('distBeforeZoom =', distBeforeZoom, ' distAfterZoom =', distAfterZoom);
  expect(distAfterZoom).toBeLessThan(distBeforeZoom * 0.95);

  await page.waitForTimeout(300);
  const distAfterSettle = await getDist();
  expect(Math.abs(distAfterSettle - distAfterZoom)).toBeLessThan(distAfterZoom * 0.2);
});
