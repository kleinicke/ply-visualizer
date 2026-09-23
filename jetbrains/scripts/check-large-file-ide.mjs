// Run with a PLY open in the isolated JCEF IDE; optional expected vertex count.
import { chromium, expect } from '@playwright/test';
const browser = await chromium.connectOverCDP(process.env.JCEF_ENDPOINT || 'http://127.0.0.1:9226', { noDefaults: true });
try {
  const pages = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().includes('host=jetbrains'));
  if (!pages.length) throw new Error('Open a PLY in the isolated IDE first');
  for (const page of pages) {
    for (let reload = 0; reload < 2; reload++) {
      if (reload) await page.reload();
      await page.waitForFunction(() => document.documentElement.dataset.jetbrainsFileDelivered === 'true', null, { timeout: 60000 });
      await page.waitForFunction(() => window.visualizer?.meshes?.length > 0 && !window.visualizer.isFileLoading, null, { timeout: 120000 });
      await expect(page.locator('[role=alert]')).toHaveCount(0);
      const state = await page.evaluate(async () => {
        let vertices = 0;
        const geometries = new Set();
        for (const mesh of window.visualizer.meshes) mesh.traverse(object => {
          // Adaptive point rendering uses two passes sharing one geometry.
          if (object.isPoints && !geometries.has(object.geometry)) {
            geometries.add(object.geometry);
            vertices += object.geometry?.attributes?.position?.count || 0;
          }
        });
        return { filename: await fetch('../filename').then(r => r.text()), vertices, delivered: document.documentElement.dataset.jetbrainsFileDelivered };
      });
      if (process.argv[2]) expect(state.vertices).toBe(Number(process.argv[2]));
      console.log(JSON.stringify({ ...state, reload: !!reload }));
    }
    // Deliberately exercise the diagnostic path, then restore the real file.
    await page.route('**/source', route => route.fulfill({ status: 503, body: 'Test failure' }));
    await page.reload();
    await expect(page.locator('[role=alert]')).toContainText('requesting file');
    await expect(page.locator('[role=alert]')).toContainText('Source HTTP 503');
    await page.unroute('**/source');
    await page.reload();
    await page.waitForFunction(() => window.visualizer?.meshes?.length > 0 && !window.visualizer.isFileLoading, null, { timeout: 120000 });
    await expect(page.locator('[role=alert]')).toHaveCount(0);
    console.log('HTTP failure includes stage/status; reload recovers.');
  }
} finally { await browser.close(); }
