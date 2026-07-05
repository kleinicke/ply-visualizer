import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Pinning coverage for depth/panelState.ts's capture/restore dance, written
 * while investigating whether to invert its DOM-scrape architecture into a
 * runes store (docs/SVELTE_MIGRATION_PLAN.md's "Deferred follow-ups"). Every
 * updateFileList() call remounts FileList/FileItem/DepthSettingsPanel (the
 * {#key filesState.renderTick} pattern), which would normally wipe native
 * input values and collapse open panels — captureDepthPanelStates/
 * restoreDepthPanelStates exist specifically to survive that.
 *
 * Loading a second file fires TWO of these remounts in quick succession for
 * one logical operation: showImmediateLoading()'s own capture/restore (now
 * present - previously this call site had none at all, a real bug fixed
 * alongside this test) and displayFiles()'s pre-existing capture/restore
 * around addNewFiles(). restoreDepthPanelStates() defers its DOM write via
 * setTimeout(10) ("wait a bit for the DOM to be updated"), so when both
 * remounts land within that window, the second capture can run before the
 * first restore has committed, capturing the fresh (just-remounted, not yet
 * restored) default state instead of the pre-remount edit - the edit is
 * still lost, just later and less often than before this fix. Closing that
 * race for good needs either a tick()-based restore the two call sites
 * coordinate around, or the store-based rewrite that was the original goal
 * here; both are riskier than this pass's time/verification budget allows
 * for a pipeline that must keep working. This test pins the current
 * (improved-but-not-fully-closed) outcome so a future attempt has a
 * concrete regression check.
 */
test.describe('Depth panel state across a file-list remount', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(1000);
  });

  test('known limitation: two remounts in quick succession (loading a second file) can still lose an in-progress edit', async ({
    page,
  }) => {
    const tifPath = path.resolve('../testfiles/tif/depth.tif');
    await page.locator('#hiddenFileInput').setInputFiles(tifPath);

    const okButton = page.locator('#depth-ok');
    await expect(okButton).toBeVisible({ timeout: 10000 });
    await page.locator('#depth-fx').fill('600');
    await okButton.click();
    await page.waitForTimeout(2000);

    await page.locator('.depth-settings-toggle[data-file-index="0"]').click();
    await expect(page.locator('#depth-panel-0')).toBeVisible();
    await page.locator('#fx-0').fill('700');

    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);

    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    // Documents today's actual (raced) outcome, not the ideal one: the
    // in-progress edit and open state are lost back to the last value that
    // was actually submitted (600) and closed. See the module doc comment.
    await expect(page.locator('#depth-panel-0')).toBeHidden();
    await expect(page.locator('#fx-0')).toHaveValue('600');
  });
});
