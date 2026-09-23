// Test the packaged scroll relay against real camera controls in JCEF.
import { chromium, expect } from '@playwright/test';
const browser = await chromium.connectOverCDP(process.env.JCEF_ENDPOINT || 'http://127.0.0.1:9226', { noDefaults: true });
try {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('host=jetbrains'));
  if (!page) throw new Error('Open a 3D file in the isolated IDE');
  await page.waitForFunction(() => window.visualizer?.meshes?.length > 0);
  for (const direction of [1, -1]) {
    const result = await page.evaluate(async direction => {
      const v = window.visualizer;
      const canvas = document.querySelector('#three-canvas');
      const rect = canvas.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / innerWidth;
      const y = (rect.top + rect.height / 2) / innerHeight;
      let count = 0;
      const onWheel = () => count++;
      canvas.addEventListener('wheel', onWheel);
      const distances = [];
      for (let i = 0; i < 150; i++) {
        if (i < 60) window.jetbrainsScroll(x, y, 0, direction * (i < 40 ? 8 : 8 * (60 - i) / 20));
        await new Promise(requestAnimationFrame);
        distances.push(v.camera.position.distanceTo(v.controls.target));
      }
      canvas.removeEventListener('wheel', onWheel);
      return { count, distances };
    }, direction);
    expect(result.count).toBe(60);
    const steps = result.distances.slice(1).map((distance, i) => Math.abs(Math.log(distance / result.distances[i])));
    expect(steps.every(Number.isFinite)).toBe(true);
    expect(Math.max(...steps)).toBeGreaterThan(0);
    // Allow frame ordering at release; the remaining camera easing must decay.
    for (let i = 63; i < steps.length; i++) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1] + 1e-6);
    expect(steps.at(-1)).toBeLessThan(1e-5);
    console.log(`${direction > 0 ? 'Out' : 'In'}: 60 precise wheel events, decaying tail, no late zoom jump`);
  }
} finally { await browser.close(); }
