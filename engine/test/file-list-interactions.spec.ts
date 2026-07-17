import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Pinning coverage for updateFileList() interactions, written before Svelte
 * Phase 3 (docs/SVELTE_MIGRATION_PLAN.md) rewrites this ~1,600-line block
 * into FileList.svelte/FileItem.svelte/DepthSettingsPanel.svelte. These
 * assertions describe today's behavior so the rewrite can be checked against
 * them without needing to re-derive what "correct" looks like.
 */
test.describe('File list interactions (pinned pre-Phase-3 behavior)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(1000);
  });

  test('toggle file visibility checkbox', async ({ page }) => {
    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);

    const checkbox = page.locator('#file-0');
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });

  test('shift-click toggles between one visible file and all visible files', async ({ page }) => {
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const first = page.locator('#file-0');
    const second = page.locator('#file-1');
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();

    await first.click({ modifiers: ['Shift'] });
    await expect(first).toBeChecked();
    await expect(second).not.toBeChecked();

    await first.click({ modifiers: ['Shift'] });
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
  });

  test('collapse and expand a file item', async ({ page }) => {
    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);

    const content = page.locator('#file-content-0');
    const toggle = page.locator('.collapse-toggle[data-file-index="0"]');
    await expect(content).toBeVisible();
    await toggle.click();
    await expect(content).toBeHidden();
    await toggle.click();
    await expect(content).toBeVisible();
  });

  test('change color mode for a file', async ({ page }) => {
    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);

    const colorSelect = page.locator('#color-0');
    await colorSelect.selectOption('assigned');
    await expect(colorSelect).toHaveValue('assigned');
  });

  test('remove a file from the list', async ({ page }) => {
    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);

    await page.locator('.remove-file[data-file-index="0"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#file-list .file-item')).toHaveCount(0);
  });

  test('edit depth settings for a loaded depth file', async ({ page }) => {
    const tifPath = path.resolve('../testfiles/tif/depth.tif');
    await page.locator('#hiddenFileInput').setInputFiles(tifPath);

    // The browser-side camera params dialog blocks conversion until submitted.
    const okButton = page.locator('#depth-ok');
    await expect(okButton).toBeVisible({ timeout: 10000 });
    await page.locator('#depth-fx').fill('600');
    await okButton.click();
    await page.waitForTimeout(2000);

    await expect(page.locator('#file-list .file-item')).toHaveCount(1);

    await page.locator('.depth-settings-toggle[data-file-index="0"]').click();
    const fxInput = page.locator('#fx-0');
    await expect(fxInput).toBeVisible();
    await fxInput.fill('700');
    await expect(fxInput).toHaveValue('700');

    const liveUpdateCheckbox = page.locator('.live-depth-update[data-file-index="0"]');
    await expect(liveUpdateCheckbox).not.toBeChecked();
    await liveUpdateCheckbox.click();
    await expect(liveUpdateCheckbox).toBeChecked();
  });
});
