import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('Shift applies compatible file controls to all clouds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([
        path.resolve('../testfiles/ply/test_small_mesh.ply'),
        path.resolve('../testfiles/ply/test_ascii.ply'),
      ]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  });

  test('shift-dragging one point-size slider sets every cloud size', async ({ page }) => {
    const first = page.locator('#size-0');
    const second = page.locator('#size-1');
    await first.fill('0.003');
    await second.fill('0.008');

    await first.dispatchEvent('pointerdown', { shiftKey: true, pointerId: 1 });
    await first.fill('0.0123');
    await first.dispatchEvent('pointerup', { pointerId: 1 });

    const sizes = await page.evaluate(() => (window as any).visualizer.pointSizes.slice(0, 2));
    expect(sizes[0]).toBeCloseTo(0.0123, 6);
    expect(sizes[1]).toBeCloseTo(0.0123, 6);
    await expect(page.locator('#all-point-sizes-value')).toHaveValue('0.0123');
  });

  test('shift-selecting a color changes compatible clouds and leaves others alone', async ({
    page,
  }) => {
    await page.locator('#color-0').selectOption('assigned');
    await page.locator('#color-1').selectOption('1');
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.individualColorModes.slice(0, 2)))
      .toEqual(['assigned', '1']);

    const first = page.locator('#color-0');
    // Shift at list-open time is irrelevant if it is released before the
    // option is committed.
    await page.keyboard.down('Shift');
    await first.dispatchEvent('pointerdown', { shiftKey: true, pointerId: 1 });
    await page.keyboard.up('Shift');
    await first.selectOption('0');
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.individualColorModes.slice(0, 2)))
      .toEqual(['0', '1']);

    await page.keyboard.down('Shift');
    await first.selectOption('original');
    await page.keyboard.up('Shift');

    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.individualColorModes.slice(0, 2)))
      .toEqual(['original', '1']);

    await page.keyboard.down('Shift');
    await first.selectOption('0');
    await page.keyboard.up('Shift');
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.individualColorModes.slice(0, 2)))
      .toEqual(['0', '0']);
  });

  test('shift-clicking a render mode synchronizes only files that offer it', async ({ page }) => {
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/ply/test_small_mesh_binary.ply'));
    await expect(page.locator('#file-list .file-item')).toHaveCount(3);

    const mesh = page.locator('.mesh-btn[data-file-index="0"]');
    const otherMesh = page.locator('.mesh-btn[data-file-index="2"]');
    await expect(mesh).toHaveClass(/active/);
    await expect(page.locator('.mesh-btn[data-file-index="1"]')).toHaveCount(0);
    await otherMesh.click();
    await expect(otherMesh).not.toHaveClass(/active/);

    await mesh.click({ modifiers: ['Shift'] });
    expect(await page.evaluate(() => (window as any).visualizer.solidVisible.slice(0, 3))).toEqual([
      false,
      false,
      false,
    ]);

    await mesh.click({ modifiers: ['Shift'] });
    expect(await page.evaluate(() => (window as any).visualizer.solidVisible.slice(0, 3))).toEqual([
      true,
      false,
      true,
    ]);
  });
});
