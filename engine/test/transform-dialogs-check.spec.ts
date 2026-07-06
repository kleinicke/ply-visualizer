import { test, expect } from '@playwright/test';
import path from 'path';

test('Phase 5: transform dialogs open, apply, and close', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(2000);

  // Open the Transform section for file 0
  await page.locator('.transform-toggle[data-file-index="0"]').click();
  await expect(page.locator('#transform-panel-0')).toBeVisible();

  // Translation dialog
  await page.locator('.add-translation[data-file-index="0"]').click();
  const translationInput = page.locator('#translation-input');
  await expect(translationInput).toBeVisible();
  await translationInput.fill('1 2 3');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(translationInput).toBeHidden();

  // Quaternion dialog, cancel path
  await page.locator('.add-quaternion[data-file-index="0"]').click();
  const quatInput = page.locator('#quaternion-input');
  await expect(quatInput).toBeVisible();
  await page.locator('button:has-text("Cancel")').click();
  await expect(quatInput).toBeHidden();

  // Camera Modify Position dialog (Camera tab)
  await page.click('[data-tab="camera"]');
  await page.waitForTimeout(300);
  await page.locator('#modify-camera-position').click();
  const posInput = page.locator('#camera-position-input');
  await expect(posInput).toBeVisible();
  await page.locator('button:has-text("Set All to 0")').click();
  await expect(posInput).toHaveValue('0 0 0');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(posInput).toBeHidden();
  await expect(page.locator('#camera-controls-panel')).toContainText('(0.000, 0.000, 0.000)');
});
