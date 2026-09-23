import { test, expect } from '@playwright/test';

for (const host of ['jetbrains', 'vscode', 'website']) {
  test(`${host}: mount welcome content only on the website`, async ({ page }) => {
    await page.route('https://analytics.re4vive.com/**', route => route.abort());
    await page.addInitScript(host => {
      (window as any).__welcomeMounted = false;
      new MutationObserver(records => {
        for (const record of records)
          {for (const node of record.addedNodes) {
            if (
              node instanceof Element &&
              (node.matches('#welcome-message') || node.querySelector('#welcome-message'))
            )
              {(window as any).__welcomeMounted = true;}
          }}
      }).observe(document, { subtree: true, childList: true });
      if (host === 'vscode')
        {(window as any).acquireVsCodeApi = () => ({
          postMessage() {},
          getState: () => ({}),
          setState() {},
        });}
    }, host);
    await page.goto(host === 'jetbrains' ? '/?host=jetbrains' : '/');
    await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
    await expect(page.locator('#three-canvas')).toBeVisible();
    if (host === 'website') {
      await expect(page.locator('#welcome-message')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Guided example', exact: true })).toBeVisible();
    } else {
      await expect(page.locator('#welcome-message')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__welcomeMounted)).toBe(false);
    }
  });
}
