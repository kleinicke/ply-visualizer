import { test, expect } from '@playwright/test';
import path from 'path';

test('inverse-trackball stays stable (no up-vector drift/NaN) over sustained rotation', async ({
  page,
}) => {
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

  // Sustained circular + back-and-forth dragging, like a real user session
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const N = 120;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 6;
    const x = cx + Math.cos(t) * 150;
    const y = cy + Math.sin(t) * 100;
    await page.mouse.move(x, y, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    const up = v.camera.up;
    const pos = v.camera.position;
    return {
      up: [up.x, up.y, up.z],
      upLength: up.length(),
      pos: [pos.x, pos.y, pos.z],
      distToTarget: pos.distanceTo(v.controls.target),
    };
  });

  console.log('camera state after sustained inverse-trackball rotation:', JSON.stringify(state));

  expect(
    Number.isFinite(state.up[0]) && Number.isFinite(state.up[1]) && Number.isFinite(state.up[2])
  ).toBe(true);
  expect(state.upLength).toBeGreaterThan(0.99);
  expect(state.upLength).toBeLessThan(1.01);
  expect(Number.isFinite(state.distToTarget)).toBe(true);
});
