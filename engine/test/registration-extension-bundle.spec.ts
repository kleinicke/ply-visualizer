import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Runs registration against the **extension's** webview bundle, not the
 * standalone page's.
 *
 * This spec exists because of a bug that hid behind exactly that difference.
 * The two bundles come from two webpack configs, and an alias that was added to
 * only one of them left the extension's build reaching for a CommonJS
 * `require()` that a webview can never resolve. Every existing spec passed —
 * they all exercise `engine/dist/bundle.js` — while in VS Code the Align button
 * did nothing at all.
 *
 * The trick is to keep the standalone page's DOM and swap only the script:
 * `page.route` answers the bundle request with `out/webview/main.js`. Workers
 * are blocked too, since a webview cannot construct one from its bundle's
 * origin, so this drives the same path the extension actually takes.
 */

const extensionBundle = path.resolve('../out/webview/main.js');

test.describe('Registration in the extension webview bundle', () => {
  test.skip(
    !fs.existsSync(extensionBundle),
    'out/webview/main.js is not built; run `npm run compile` at the repo root'
  );

  test('aligns with the extension bundle and no worker', async ({ page }) => {
    test.slow();
    const consoleErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.addInitScript(() => {
      // A webview serves its bundle from a different origin than the document,
      // so the Worker constructor rejects the script.
      (window as any).Worker = class {
        constructor() {
          throw new Error('Worker construction blocked for this test');
        }
      };
    });
    // The extension bundle is split, and it pulls chunks in during start-up, so
    // serving only its entry leaves the page dead on a 404. Every asset it asks
    // for has to come from out/webview/, not from the page's own dist — the
    // content-hashed wasm included. That one used to 404 harmlessly because a
    // JavaScript parser stood behind it; now that parsing is Rust, a missed
    // wasm means the page loads no files at all.
    const bundleDirectory = path.dirname(extensionBundle);
    await page.route('**/*.{js,wasm}', async route => {
      const requested = path.basename(new URL(route.request().url()).pathname);
      const candidate = path.join(
        bundleDirectory,
        requested === 'bundle.js' ? 'main.js' : requested
      );
      if (!fs.existsSync(candidate)) {
        await route.continue();
        return;
      }
      const isWasm = candidate.endsWith('.wasm');
      await route.fulfill({
        contentType: isWasm ? 'application/wasm' : 'application/javascript',
        body: isWasm ? fs.readFileSync(candidate) : fs.readFileSync(candidate, 'utf8'),
      });
    });

    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(1000);

    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    // The pair workspace moved into the Align menu.
    await page.locator('#global-align-toggle').click();
    await page.locator('.align-single-toggle').click();
    await page.locator('#global-align-single-fixed').selectOption('1');
    const panel = page.locator('#global-align-menu');
    await panel.locator('.registration-icp').click();

    const result = panel.locator('.registration-result');
    await expect(result).toBeVisible({ timeout: 60_000 });
    const text = (await result.textContent()) ?? '';
    // The specific regression: the loader could not be found, so the button
    // produced nothing a user could act on.
    expect(text).not.toContain('WebAssembly module failed');
    expect(text).not.toContain('Alignment failed');
    expect(text.length).toBeGreaterThan(0);
  });
});
