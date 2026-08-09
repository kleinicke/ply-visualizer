import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Capture places: one toggle for everything shot from one tripod position.
 *
 * The grouping is derived from where the scans registered, because an X3A says
 * nothing about which sweep belongs to which setup. Two clouds placed metres
 * apart are two places; the same clouds on one origin are one.
 */
test.describe('Capture places', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  });

  /** Makes both clouds look like scans out of one archive. */
  async function makeArchive(page: any, secondOffset: number) {
    await page.evaluate((offset: number) => {
      const visualizer = (window as any).visualizer;
      visualizer.runningInVSCode = true;
      ['A', 'B'].forEach((suffix, index) => {
        visualizer.spatialFiles[index].metadata = {
          ...(visualizer.spatialFiles[index].metadata ?? {}),
          containerFileName: 'Site.x3a',
          embeddedScanName: `Site_000${index}${suffix}.x3r`,
        };
      });
      visualizer.transformationMatrices[1].makeTranslation(offset, 0, 0);
      visualizer.updateFileList();
    }, secondOffset);
  }

  test('groups scans on one origin as a single place', async ({ page }) => {
    await makeArchive(page, 0);
    await page.locator('.file-item').nth(0).locator('.registration-toggle').click();
    // One place is not worth a list; the section only appears when they differ.
    await expect(page.locator('.capture-place-toggle')).toHaveCount(0);
  });

  test('separates registered positions and hides one at a time', async ({ page }) => {
    await makeArchive(page, 12);
    await page.locator('.file-item').nth(0).locator('.registration-toggle').click();

    const toggles = page.locator('.capture-place-toggle');
    await expect(toggles).toHaveCount(2);

    await toggles.nth(1).uncheck();
    const visibility = await page.evaluate(
      () => (window as any).visualizer.fileVisibility.slice(0, 2) as boolean[]
    );
    expect(visibility[0]).toBe(true);
    expect(visibility[1]).toBe(false);
  });
});
