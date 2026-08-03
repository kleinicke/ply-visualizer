import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The depth load used to emit three separate PERF lines (transfer, wasm decode,
 * convert/build) that could not be added up: the transfer line was logged from
 * a different clock than the timer, and the decode happened inside the worker.
 * This pins the consolidated replacement - exactly one line, whose phases sum
 * to the reported total.
 */
test('a depth load emits exactly one PERF line whose phases sum to the total', async ({ page }) => {
  const perfLines: string[] = [];
  page.on('console', message => {
    const text = message.text();
    if (text.includes('PERF[')) {
      perfLines.push(text);
    }
  });

  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');

  await page.locator('#hiddenFileInput').setInputFiles(path.resolve('../testfiles/tif/depth.tif'));
  const okButton = page.locator('#depth-ok');
  await expect(okButton).toBeVisible({ timeout: 10000 });
  await okButton.click();
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(500);

  const depthLines = perfLines.filter(line => /PERF\[(tiff|depth)[\s\]]/.test(line));
  expect(depthLines).toHaveLength(1);

  const line = depthLines[0];
  // Format: ⏱️ PERF[tiff depth.tif] a 1ms · b 2ms | total 3ms  (extras)
  const total = Number(/\| total ([\d.]+)ms/.exec(line)?.[1]);
  expect(Number.isFinite(total)).toBe(true);

  const phaseSection = line.slice(line.indexOf(']') + 1, line.indexOf('| total'));
  const phases = [...phaseSection.matchAll(/([\w+()-]+) ([\d.]+)ms/g)];
  expect(phases.length).toBeGreaterThan(1);

  // The decode must be reported as its own phase rather than a separate line.
  expect(phases.some(([, name]) => name.startsWith('decode'))).toBe(true);

  const sum = phases.reduce((acc, [, , ms]) => acc + Number(ms), 0);
  // Phases are measured on two clocks (wall-clock epochs across the process
  // boundary, performance.now() inside the webview), so allow a small drift.
  expect(Math.abs(sum - total)).toBeLessThan(Math.max(20, total * 0.1));
});
