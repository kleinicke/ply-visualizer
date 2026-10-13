import { test, expect, type Page } from '@playwright/test';

const cloud = Buffer.from(
  'ply\nformat ascii 1.0\nelement vertex 4\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n0 0 1\n'
);

const looping = (page: Page) =>
  page.evaluate(() => (window as any).visualizer.animationId !== null);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'sleep.ply',
    mimeType: 'application/octet-stream',
    buffer: cloud,
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(1);
});

test('an idle render loop sleeps and every kind of change wakes it', async ({ page }) => {
  await expect.poll(() => looping(page), { timeout: 5000 }).toBe(false);

  // A render request wakes it.
  await page.evaluate(() => (window as any).visualizer.requestRender());
  expect(await looping(page)).toBe(true);
  await expect.poll(() => looping(page), { timeout: 5000 }).toBe(false);

  // So does a camera moved without asking for a render (the watchdog).
  await page.evaluate(() => ((window as any).visualizer.camera.position.x += 0.5));
  await expect.poll(() => looping(page), { timeout: 2000 }).toBe(true);
  await expect.poll(() => looping(page), { timeout: 5000 }).toBe(false);

  // And input: a real drag on the canvas still rotates the camera.
  const before = await page.evaluate(() => (window as any).visualizer.camera.quaternion.toArray());
  const box = (await page.locator('#three-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width / 2 + i * 15, box.y + box.height / 2);
  }
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.camera.quaternion.toArray()))
    .not.toEqual(before);
});

test('an explicitly stopped loop stays stopped', async ({ page }) => {
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.stopRenderLoop();
    v.requestRender();
    v.camera.position.x += 1;
  });
  await page.mouse.move(10, 10);
  await page.waitForTimeout(600);
  expect(await looping(page)).toBe(false);
});
