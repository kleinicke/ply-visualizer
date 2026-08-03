import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Load-order independence for the file list.
 *
 * The panel addresses point clouds, poses and camera profiles through one index
 * space, and every entry's per-entry state (visibility, scale, colour mode,
 * transform) is stored against that index. Before state/fileEntries.ts owned
 * the ordering, a point cloud loaded *after* a camera profile appended its own
 * state past the camera's slot while the camera's index shifted up onto it, so
 * the two swapped state. These tests load the same files in both orders and
 * check that each row keeps its own.
 */

/** The list also renders a transient "Loading …" row; it is not an entry. */
const ROWS = '#file-list .file-item:not(.file-item-loading)';

const PLY = path.resolve('../testfiles/ply/test_ascii.ply');
const CAMERA_PROFILE = path.resolve('../testfiles/json/camera_profile.json');
const POSE = path.resolve('../testfiles/json/hpe_3d_reduced_nonan.json');

async function open(page: import('@playwright/test').Page) {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
}

async function load(page: import('@playwright/test').Page, file: string, expectedRows: number) {
  await page.locator('#hiddenFileInput').setInputFiles(file);
  await expect(page.locator(ROWS)).toHaveCount(expectedRows);
}

/** Row labels top to bottom, so ordering is asserted on what the user sees. */
async function rowNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator(`${ROWS} .file-name`).allInnerTexts();
}

test.describe('File entry ordering', () => {
  test('camera profile keeps its row when a point cloud is loaded after it', async ({ page }) => {
    await open(page);
    await load(page, CAMERA_PROFILE, 1);
    await load(page, PLY, 2);

    // Point clouds sort before camera profiles whatever the load order.
    const names = await rowNames(page);
    expect(names[0]).toContain('test_ascii.ply');
    expect(names[1]).toContain('camera_profile.json');

    // The camera row still owns a camera profile's controls, not the PLY's.
    const cameraRow = page.locator(ROWS).nth(1);
    await expect(cameraRow.getByRole('button', { name: /Individual cameras/ })).toBeVisible();
  });

  test('per-entry state survives a later load', async ({ page }) => {
    await open(page);
    await load(page, CAMERA_PROFILE, 1);

    // Hide the camera profile, then load a point cloud. The visibility bit must
    // stay with the camera row rather than transferring to the new file.
    // The row's own visibility checkbox is `#file-<unified index>`.
    await page.locator('#file-0').uncheck();
    await expect(page.locator('#file-0')).not.toBeChecked();

    await load(page, PLY, 2);

    // The camera profile moved to index 1 and kept its hidden state; the new
    // point cloud took index 0 and is visible.
    await expect(page.locator('#file-0')).toBeChecked();
    await expect(page.locator('#file-1')).not.toBeChecked();
  });

  test('a pose loaded between a cloud and a camera lands in its own block', async ({ page }) => {
    await open(page);
    await load(page, CAMERA_PROFILE, 1);
    await load(page, PLY, 2);
    await load(page, POSE, 3);

    const names = await rowNames(page);
    expect(names[0]).toContain('test_ascii.ply');
    expect(names[2]).toContain('camera_profile.json');

    // The pose row sits between them and carries pose-only controls.
    await expect(page.locator('#pose-conv-1')).toBeVisible();
  });

  test('removing a point cloud leaves the camera profile intact', async ({ page }) => {
    await open(page);
    await load(page, PLY, 1);
    await load(page, CAMERA_PROFILE, 2);

    // The remove button posts to the extension host, which the standalone page
    // has no counterpart for, so the removal itself is driven directly.
    await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
    await expect(page.locator(ROWS)).toHaveCount(1);

    const names = await rowNames(page);
    expect(names[0]).toContain('camera_profile.json');
    await expect(
      page
        .locator(ROWS)
        .nth(0)
        .getByRole('button', {
          name: /Individual cameras/,
        })
    ).toBeVisible();
  });
});
