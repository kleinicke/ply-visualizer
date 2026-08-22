import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);

  // Give every panel enough content to make the shared tab-content element
  // scrollable without depending on whichever controls happen to be present.
  await page.evaluate(() => {
    for (const panel of document.querySelectorAll<HTMLElement>('.tab-panel')) {
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      spacer.dataset.testScrollSpacer = 'true';
      panel.appendChild(spacer);
    }
  });
});

async function setScroll(page: import('@playwright/test').Page, value: number): Promise<number> {
  return page.locator('.tab-content').evaluate((element, requested) => {
    element.scrollTop = requested;
    return element.scrollTop;
  }, value);
}

async function scrollTop(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('.tab-content').evaluate(element => element.scrollTop);
}

test('restores an independent scroll position for every view mode', async ({ page }) => {
  const filesPosition = await setScroll(page, 240);

  await page.locator('[data-tab="camera"]').click();
  expect(await scrollTop(page)).toBe(0);
  const cameraPosition = await setScroll(page, 410);

  await page.locator('[data-tab="controls"]').click();
  expect(await scrollTop(page)).toBe(0);
  const controlsPosition = await setScroll(page, 680);

  await page.locator('[data-tab="info"]').click();
  expect(await scrollTop(page)).toBe(0);
  const infoPosition = await setScroll(page, 125);

  await page.locator('[data-tab="files"]').click();
  expect(await scrollTop(page)).toBe(filesPosition);

  await page.locator('[data-tab="camera"]').click();
  expect(await scrollTop(page)).toBe(cameraPosition);

  await page.locator('[data-tab="controls"]').click();
  expect(await scrollTop(page)).toBe(controlsPosition);

  await page.locator('[data-tab="info"]').click();
  expect(await scrollTop(page)).toBe(infoPosition);
});
