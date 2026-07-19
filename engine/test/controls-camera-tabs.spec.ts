import { test, expect } from '@playwright/test';
import path from 'path';

test('Phase 4: controls tab, camera tab, and stats render and respond', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  // Switch to Controls tab
  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);

  const edlBtn = page.locator('#toggle-edl');
  await expect(edlBtn).toBeVisible();
  await expect(edlBtn).not.toHaveClass(/active/);
  await edlBtn.click();
  await expect(edlBtn).toHaveClass(/active/);
  const edlSettings = page.locator('#edl-settings');
  await expect(edlSettings).toBeVisible();

  const secondRing = page.locator('#edl-second-ring-slider');
  await secondRing.fill('0.4');
  await secondRing.dblclick();
  await expect(secondRing).toHaveValue('0');
  const edlStrength = page.locator('#edl-strength-slider');
  await edlStrength.fill('2.5');
  await edlStrength.dblclick();
  await expect(edlStrength).toHaveValue('1');
  const edlRadius = page.locator('#edl-radius-slider');
  await edlRadius.fill('3');
  await edlRadius.dblclick();
  await expect(edlRadius).toHaveValue('1.4');

  const trackballBtn = page.locator('#trackball-controls');
  await trackballBtn.click();
  await expect(trackballBtn).toHaveClass(/active/);
  const orbitBtn = page.locator('#orbit-controls');
  await orbitBtn.click();
  await expect(orbitBtn).toHaveClass(/active/);
  await expect(trackballBtn).not.toHaveClass(/active/);

  const openglBtn = page.locator('#opengl-convention');
  await expect(openglBtn).toHaveClass(/active/);
  const opencvBtn = page.locator('#opencv-convention');
  await opencvBtn.click();
  await expect(opencvBtn).toHaveClass(/active/);

  // Switch to Camera tab
  await page.click('[data-tab="camera"]');
  await page.waitForTimeout(300);
  const fovSlider = page.locator('#camera-fov');
  await expect(fovSlider).toBeVisible();
  await fovSlider.fill('110');
  await fovSlider.dblclick();
  await expect(fovSlider).toHaveValue('75');
  await expect(page.locator('#fov-input')).toHaveValue('75.00');
  const positionDisplay = page.locator('#camera-controls-panel');
  await expect(positionDisplay).toContainText('Position:');

  // Load a file and check stats
  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(2000);
  await page.click('[data-tab="info"]');
  await expect(page.locator('#file-stats')).toContainText('Vertices');
});
