// Run against an isolated IDE with this plugin installed and a PLY editor open.
// Tests the actual JCEF viewer; native picker/save dialogs remain separate checks.
import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const endpoint = process.env.JCEF_ENDPOINT || 'http://127.0.0.1:9226';
const browser = await chromium.connectOverCDP(endpoint, { noDefaults: true });
try {
  const page = browser
    .contexts()
    .flatMap(context => context.pages())
    .find(page => page.url().includes('host=jetbrains'));
  if (!page) throw new Error('Open a PLY file in the isolated test IDE first');
  await page.reload();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.visualizer?.meshes?.length > 0);
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  await expect(page.locator('.bottom-right-nav')).toHaveCount(0);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('testfiles/stl/test_cube_ascii.stl'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  const visibility = page.locator('#file-list .file-item input[type=checkbox]').first();
  await visibility.uncheck();
  await expect.poll(() => page.evaluate(() => window.visualizer.meshes[0].visible)).toBe(false);
  await visibility.check();
  await expect.poll(() => page.evaluate(() => window.visualizer.meshes[0].visible)).toBe(true);
  const before = await page.evaluate(() => window.visualizer.camera.position.toArray());
  const canvas = page.locator('#three-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.visualizer.camera.position.toArray()))
    .not.toEqual(before);
  await mkdir('jetbrains/build/release-evidence', { recursive: true });
  await page.screenshot({ path: 'jetbrains/build/release-evidence/jcef-viewer.png' });
  await page.locator('[data-tab=controls]').click();
  const spots = await page.evaluate(() => {
    const v = window.visualizer;
    v.selectionManager.updateContext(v.getSelectionContext());
    const canvas = v.renderer.domElement;
    const points = [];
    for (let y = .2; y < .8 && points.length < 2; y += .05) {
      for (let x = .15; x < .5 && points.length < 2; x += .05) {
        const px = Math.round(canvas.clientWidth * x), py = Math.round(canvas.clientHeight * y);
        if (v.selectionManager.selectPointWithLogging(px, py, canvas) &&
            points.every(([x, y]) => Math.hypot(x - px, y - py) > 60)) points.push([px, py]);
      }
    }
    return points;
  });
  expect(spots).toHaveLength(2);
  await page.locator('#new-measurement-path').click();
  for (const [x, y] of spots) await canvas.dblclick({ position: { x, y }, modifiers: ['Shift'] });
  await expect.poll(() => page.evaluate(() => window.visualizer.measurementManager.getPathPoints().length)).toBe(2);
  await page.locator('#clear-measurement-path').click();
  await expect.poll(() => page.evaluate(() => window.visualizer.measurementManager.getPathPoints().length)).toBe(0);
  await page.locator('#hiddenFileInput').setInputFiles({ name: 'broken.ply', mimeType: 'application/octet-stream', buffer: Buffer.from('not a PLY file') });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-message')).not.toHaveText('');
  await page.locator('#error-close').click();
  await page.locator('[data-tab=files]').click();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'PASS: packaged JCEF viewer, initial load, multiple objects, visibility, camera rotation, measurement/clear, malformed-file feedback, no page errors.'
  );
} finally {
  // Disconnect the test client without closing the user's IDE.
  await browser.close();
}
