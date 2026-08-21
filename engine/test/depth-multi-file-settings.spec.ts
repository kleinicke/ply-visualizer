import { test, expect, type Page } from '@playwright/test';
import path from 'path';

/**
 * Depth settings must act on the file whose panel you edited — every file, not
 * just the first.
 *
 * Every control here is addressed by an id built from the file index
 * (`fx-1`, `depth-panel-1`, …) and every handler passes its own index into a
 * per-index registry (`liveDepthUpdateFiles`, `fileDepthData`,
 * `liveDepthUpdateVersions`). That is a lot of parallel bookkeeping for one
 * gesture, and nothing before this test checked that the second file's copy of
 * it is wired to the second file.
 */
async function loadTwoDepthImages(page: Page): Promise<void> {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles([
      path.resolve('../testfiles/tif/depth.tif'),
      path.resolve('../testfiles/tif/depth_zstd.tif'),
    ]);
  // One camera-parameter dialog per image, answered in turn. The conversion
  // behind each one runs after its dialog closes, so the counts are only
  // checked at the end rather than between the two.
  for (let index = 0; index < 2; index++) {
    await expect(page.locator('#depth-fx')).toBeVisible();
    await page.locator('#depth-fx').fill('1000');
    await page.locator('#depth-ok').click();
    await page.waitForTimeout(2500);
  }
  await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  await expect(page.locator('#depth-panel-1')).toHaveCount(1);
}

/** First vertex of each cloud, which any reprojection moves. */
function firstVertices(page: Page) {
  return page.evaluate(() =>
    (window as any).visualizer.meshes.map((mesh: any) =>
      Array.from(mesh.geometry.getAttribute('position').array.slice(0, 3) as Float32Array)
    )
  );
}

async function openPanel(page: Page, fileIndex: number) {
  if (!(await page.locator(`#depth-panel-${fileIndex}`).isVisible())) {
    await page.locator('.depth-settings-toggle').nth(fileIndex).click();
  }
  await expect(page.locator(`#depth-panel-${fileIndex}`)).toBeVisible();
}

test('live update reprojects the second depth image, and only that one', async ({ page }) => {
  test.slow();
  await loadTwoDepthImages(page);

  // Live update is meant to be on for every depth file, not just the first.
  expect(
    await page.evaluate(() => [...((window as any).visualizer.liveDepthUpdateFiles ?? [])].sort())
  ).toEqual([0, 1]);

  await openPanel(page, 1);
  const before = await firstVertices(page);

  await page.locator('#fx-1').fill('400');
  await page.locator('#fx-1').press('Enter');

  await expect
    .poll(async () => (await firstVertices(page))[1][0], { timeout: 30_000 })
    .not.toBe(before[1][0]);
  // ...and the first image was left exactly where it was.
  expect((await firstVertices(page))[0]).toEqual(before[0]);
});

test('the first depth image still reprojects after the second one is loaded', async ({ page }) => {
  test.slow();
  await loadTwoDepthImages(page);
  await openPanel(page, 0);
  const before = await firstVertices(page);

  await page.locator('#fx-0').fill('400');
  await page.locator('#fx-0').press('Enter');

  await expect
    .poll(async () => (await firstVertices(page))[0][0], { timeout: 30_000 })
    .not.toBe(before[0][0]);
  expect((await firstVertices(page))[1]).toEqual(before[1]);
});

test('a manual apply reprojects the second image when live update is off', async ({ page }) => {
  test.slow();
  await loadTwoDepthImages(page);
  await openPanel(page, 1);

  await page.locator('#depth-panel-1 .live-depth-update').uncheck();
  const before = await firstVertices(page);
  await page.locator('#fx-1').fill('400');
  await page.locator('#fx-1').press('Enter');
  // With live update off, committing a field must change nothing on its own.
  await page.waitForTimeout(1500);
  expect((await firstVertices(page))[1]).toEqual(before[1]);

  await page.locator('.apply-depth-settings[data-file-index="1"]').click();
  await expect
    .poll(async () => (await firstVertices(page))[1][0], { timeout: 30_000 })
    .not.toBe(before[1][0]);
});

test('a depth image added after the first still live-updates', async ({ page }) => {
  test.slow();
  // The other way two depth images end up loaded: one at a time, through the
  // add-file path rather than one multi-select.
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);
  for (const file of ['../testfiles/tif/depth.tif', '../testfiles/tif/depth_zstd.tif']) {
    await page.locator('#hiddenFileInput').setInputFiles(path.resolve(file));
    await expect(page.locator('#depth-fx')).toBeVisible();
    await page.locator('#depth-fx').fill('1000');
    await page.locator('#depth-ok').click();
    await page.waitForTimeout(2500);
  }
  await expect(page.locator('#file-list .file-item')).toHaveCount(2);

  expect(
    await page.evaluate(() => [...((window as any).visualizer.liveDepthUpdateFiles ?? [])].sort())
  ).toEqual([0, 1]);

  await openPanel(page, 1);
  const before = await firstVertices(page);
  await page.locator('#fx-1').fill('400');
  await page.locator('#fx-1').press('Enter');

  await expect
    .poll(async () => (await firstVertices(page))[1][0], { timeout: 30_000 })
    .not.toBe(before[1][0]);
});

/**
 * The arrow and the panel are one state, not two.
 *
 * Three places used to open the panel by writing `style.display` and the
 * arrow's text directly. The component still believed it was closed, so the
 * next click was swallowed — the panel stayed put and the arrow appeared stuck.
 */
test('the depth settings arrow tracks the panel through every click', async ({ page }) => {
  test.slow();
  await loadTwoDepthImages(page);

  const arrow = page.locator('.depth-settings-toggle').nth(1).locator('.toggle-icon');
  const panel = page.locator('#depth-panel-1');

  const startedOpen = await panel.isVisible();
  await expect(arrow).toHaveText(startedOpen ? '▼' : '▶');

  // Every click must move both, starting with the very first one.
  for (let click = 0; click < 3; click++) {
    const wasOpen = await panel.isVisible();
    await page.locator('.depth-settings-toggle').nth(1).click();
    await expect(panel).toBeVisible({ visible: !wasOpen });
    await expect(arrow).toHaveText(wasOpen ? '▶' : '▼');
  }
});
