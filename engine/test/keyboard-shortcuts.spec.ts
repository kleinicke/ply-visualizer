import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The bare-letter shortcuts, and what they must keep their hands off.
 *
 * Every shortcut in the viewer is an unmodified letter, so a keystroke carrying
 * Cmd/Ctrl/Alt belongs to the editor or the OS. The handler used to ignore
 * modifiers entirely and call preventDefault, so Cmd+C changed the camera
 * convention *and* broke the copy — along with Cmd+A, Cmd+S and Cmd+F. C now
 * carries no viewer shortcut at all; OpenCV moved to V.
 */
test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([path.resolve('../testfiles/ply/test_small_mesh.ply')]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  });

  test('V selects the OpenCV convention and C selects nothing', async ({ page }) => {
    await page.evaluate(() => (window as any).visualizer.setOpenGLCameraConvention());
    await expect(page.locator('#opengl-convention')).toHaveClass(/active/);

    await page.locator('#three-canvas').press('c');
    await expect(page.locator('#opengl-convention')).toHaveClass(/active/);
    await expect(page.locator('#opencv-convention')).not.toHaveClass(/active/);

    await page.locator('#three-canvas').press('v');
    await expect(page.locator('#opencv-convention')).toHaveClass(/active/);
  });

  test('leaves modified keystrokes to the editor', async ({ page }) => {
    await page.evaluate(() => (window as any).visualizer.setOpenGLCameraConvention());

    // The copy keystroke must reach the page untouched: no viewer action, and
    // no preventDefault that would stop the copy itself.
    const prevented = await page.evaluate(() => {
      const modifier = navigator.platform.includes('Mac') ? 'metaKey' : 'ctrlKey';
      const event = new KeyboardEvent('keydown', {
        key: 'v',
        [modifier]: true,
        cancelable: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    // ...and the convention did not change under it.
    await expect(page.locator('#opengl-convention')).toHaveClass(/active/);
  });
});
