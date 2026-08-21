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
    const namesBefore = await page.locator('#file-list .file-name').allTextContents();
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();

    // Use a real browser click first: preventDefault on a checkbox click can
    // roll its visual state back after the application has applied solo mode.
    await second.click({ modifiers: ['Shift'] });
    await expect(first).not.toBeChecked();
    await expect(second).toBeChecked();
    await expect(page.locator('#file-list .file-name')).toHaveText(namesBefore);

    // Force a small scroll container to catch full-list remounts: those reset
    // scrollTop and made the Shift-clicked cloud appear to jump to row one.
    const scrollTopBefore = await page.locator('#file-list').evaluate(element => {
      const list = element as HTMLElement;
      list.style.height = '32px';
      list.style.overflowY = 'auto';
      list.scrollTop = list.scrollHeight;
      return list.scrollTop;
    });
    expect(scrollTopBefore).toBeGreaterThan(0);

    // dispatchEvent avoids Playwright's own scroll-into-view behavior, so any
    // scroll movement below comes from the application itself. This second
    // Shift-click restores all entries.
    await second.dispatchEvent('click', { shiftKey: true });
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
    await expect(page.locator('#file-list .file-name')).toHaveText(namesBefore);
    expect(await page.locator('#file-list').evaluate(element => element.scrollTop)).toBe(
      scrollTopBefore
    );

    await second.click({ modifiers: ['Shift'] });
    await expect(first).not.toBeChecked();
    await expect(second).toBeChecked();

    // Switching directly from one soloed cloud to another must update the
    // newly selected checkbox as well as clearing the previous one.
    await first.click({ modifiers: ['Shift'] });
    await expect(first).toBeChecked();
    await expect(second).not.toBeChecked();
  });

  test('collapse and expand a file item', async ({ page }) => {
    const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    await page.locator('#hiddenFileInput').setInputFiles(plyPath);
    await page.waitForTimeout(2000);

    await expect(page.getByText('Cross section', { exact: true })).toHaveCount(0);

    const content = page.locator('#file-content-0');
    const toggle = page.locator('.collapse-toggle[data-file-index="0"]');
    await expect(content).toBeVisible();
    await toggle.click();
    await expect(content).toBeHidden();
    await toggle.click();
    await expect(content).toBeVisible();
  });

  test('changing a mesh render mode preserves the file-list position', async ({ page }) => {
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const secondMeshButton = page.locator('.mesh-btn[data-file-index="1"]');
    await expect(secondMeshButton).toBeVisible();
    const scrollTopBefore = await page.locator('#file-list').evaluate(element => {
      const list = element as HTMLElement;
      list.style.height = '32px';
      list.style.overflowY = 'auto';
      list.scrollTop = list.scrollHeight;
      return list.scrollTop;
    });
    expect(scrollTopBefore).toBeGreaterThan(0);

    // Avoid Playwright scrolling the button into view: any movement after the
    // event must come from a list remount in the application.
    await secondMeshButton.dispatchEvent('click');
    await expect(secondMeshButton).not.toHaveClass(/active/);
    expect(await page.locator('#file-list').evaluate(element => element.scrollTop)).toBe(
      scrollTopBefore
    );

    await secondMeshButton.dispatchEvent('click');
    await expect(secondMeshButton).toHaveClass(/active/);
    expect(await page.locator('#file-list').evaluate(element => element.scrollTop)).toBe(
      scrollTopBefore
    );
  });

  test('a full file-list refresh preserves scroll and stable row DOM', async ({ page }) => {
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_small_mesh_binary.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const before = await page.locator('#file-list').evaluate(element => {
      const list = element as HTMLElement;
      list.style.height = '32px';
      list.style.overflowY = 'auto';
      list.scrollTop = list.scrollHeight;
      (list.querySelector('.file-item') as any).__stableRowMarker = 'preserved';
      return list.scrollTop;
    });
    expect(before).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).visualizer.updateFileList());

    const after = await page.locator('#file-list').evaluate(element => ({
      scrollTop: (element as HTMLElement).scrollTop,
      marker: ((element.querySelector('.file-item') as any).__stableRowMarker as string) || null,
    }));
    expect(after).toEqual({ scrollTop: before, marker: 'preserved' });
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

    // A model is always selected: the picker offers two general models, and a
    // setting naming a retired one is mapped onto them rather than leaving the
    // select blank.
    await expect(page.locator('#camera-model-0')).not.toHaveValue('');

    await page.locator('#camera-model-0').selectOption('pinhole-opencv');
    await page.locator('[data-section="distortion-content-0"]').click();
    // One box per family of terms, not one per term and not one long ordered
    // run: the radial k's together, the tangential p's together.
    await expect(page.locator('label[for="coefficient-group-0-0"]')).toContainText(
      'Radial (k1, k2, k3, k4, k5, k6)'
    );
    await expect(page.locator('label[for="coefficient-group-0-1"]')).toContainText(
      'Tangential (p1, p2)'
    );
    await expect(page.locator('label[for="coefficient-group-0-3"]')).toContainText(
      'Tilted sensor (tauX, tauY)'
    );
    await expect(page.locator('#camera-coefficient-params-0 input')).toHaveCount(4);

    // Two numbers in the radial box is a complete, valid calibration: the rest
    // of that family is zero, and so is every other family.
    await page.locator('#coefficient-group-0-0').fill('-0.28,0.07');
    await expect(page.locator('#coefficient-group-0-0')).toHaveValue('-0.28,0.07');

    // Live update starts on — changing a number and watching the cloud move is
    // how the panel is meant to be used — and turning it off has to stick.
    const liveUpdateCheckbox = page.locator('.live-depth-update[data-file-index="0"]');
    await expect(liveUpdateCheckbox).toBeChecked();
    await liveUpdateCheckbox.click();
    await expect(liveUpdateCheckbox).not.toBeChecked();
  });
});

/**
 * The renderer draws on demand. A control that changes what a cloud looks like
 * and does not ask for a frame appears to do nothing until the camera happens
 * to move, which is exactly how switching from projected colour to a flat one
 * presented itself.
 */
test('changing a colour mode asks for a frame', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(500);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh.ply'));
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);

  const renders = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    let count = 0;
    const original = visualizer.requestRender.bind(visualizer);
    visualizer.requestRender = () => {
      count++;
      original();
    };
    (window as any).__renderCount = () => count;
    return true;
  });
  expect(renders).toBe(true);

  await page.locator('#color-0').selectOption('1');
  await expect.poll(() => page.evaluate(() => (window as any).__renderCount())).toBeGreaterThan(0);
});
