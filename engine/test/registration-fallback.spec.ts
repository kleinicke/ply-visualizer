import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The panel must work, and must say something, when no Worker can be created.
 *
 * This is the VS Code webview's situation: the bundle is served from a
 * different origin than the document, so constructing a worker from it throws.
 * It went unnoticed because the standalone page — same origin — always gets its
 * worker, so every other spec exercises the happy path. Blocking `Worker` here
 * reproduces the extension's environment on the page.
 */
test.describe('Registration without a worker', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Constructing one throws exactly as it does cross-origin in a webview.
      (window as any).Worker = class {
        constructor() {
          throw new Error('Worker construction blocked for this test');
        }
      };
    });
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
  });

  test('falls back to running in the page and still reports a result', async ({ page }) => {
    test.slow();
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const panel = page.locator('.file-item').nth(1);
    await panel.locator('.registration-toggle').click();
    await panel.locator('.registration-icp').click();

    // Either a real result or an explicit failure — the one thing that must
    // never happen again is the button doing nothing at all.
    await expect(panel.locator('.registration-result')).toBeVisible({ timeout: 60_000 });
    const text = await panel.locator('.registration-result').textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain('WebAssembly module failed');
  });
});
