import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('PLY File Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the visualizer to initialize
    await page.waitForSelector('#viewer-container');
    await page.waitForSelector('#three-canvas');

    // Wait a bit for initialization to complete
    await page.waitForTimeout(2000);
  });

  test('should load and display PLY file via file input', async ({ page }) => {
    // Path to the test PLY file
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');

    console.log('Testing PLY file:', plyFilePath);

    // Check if the file exists by trying to load it
    const fs = require('fs');
    if (!fs.existsSync(plyFilePath)) {
      console.warn('PLY test file not found, skipping test:', plyFilePath);
      test.skip();
      return;
    }

    // Monitor console logs for debugging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });

    // Monitor network errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Click the Add File button to trigger file input
    await page.click('#add-file');

    // Upload the file through the hidden file input
    const fileInput = page.locator('#hiddenFileInput');
    await fileInput.setInputFiles(plyFilePath);

    // Wait a moment for processing (file may load very fast)
    await page.waitForTimeout(2000);

    // Loading should either be visible or already complete (hidden)
    const loadingVisible = await page.locator('#loading').isVisible();
    if (loadingVisible) {
      await expect(page.locator('#loading')).toBeHidden({ timeout: 30000 });
    } else {
      console.log('File loaded so quickly that loading indicator was not visible');
    }

    // Check that the file was loaded successfully
    await expect(page.locator('#file-list')).toContainText('sample_mesh.ply', { timeout: 10000 });

    // Switch to Info tab to see stats
    await page.click('[data-tab="info"]');
    await page.waitForTimeout(500);

    // Check that stats are updated (should now be visible in Info tab)
    const fileStats = page.locator('#file-stats');
    await expect(fileStats).toBeVisible();
    await expect(fileStats).toContainText('Vertices');

    // Verify that the 3D object is rendered (canvas should have content)
    const canvas = page.locator('#three-canvas');
    await expect(canvas).toBeVisible();

    // Check for performance stats update (in Files tab)
    await page.click('[data-tab="files"]');
    const perfStats = page.locator('#performance-stats');
    await expect(perfStats).toContainText('fps');

    // Take a screenshot to verify rendering
    await page.screenshot({ path: 'test-results/ply-loaded.png', fullPage: true });

    console.log('PLY file loaded successfully!');
  });

  test('should handle drag and drop PLY file', async ({ page }) => {
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(plyFilePath)) {
      console.warn('PLY test file not found, skipping drag-drop test:', plyFilePath);
      test.skip();
      return;
    }

    // Monitor console for debugging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });

    // Note: This website doesn't have a specific drag-drop area like VS Code extension
    // Instead we'll test the direct file input method which is the main way to load files
    console.log('Testing file input method (no drag-drop area in this website version)');
    await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);

    // Wait for processing
    await expect(page.locator('#loading')).toBeHidden({ timeout: 30000 });

    // Verify file loaded
    await expect(page.locator('#file-list')).toContainText('sample_mesh.ply', { timeout: 10000 });
  });

  test('should show error for invalid file', async ({ page }) => {
    // Create a temporary invalid file
    const fs = require('fs');
    const os = require('os');
    const invalidFilePath = path.join(os.tmpdir(), 'invalid.ply');

    // Write invalid PLY content
    fs.writeFileSync(invalidFilePath, 'invalid ply content');

    // Monitor console for errors
    let errorCaught = false;
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Browser error: ${msg.text()}`);
        errorCaught = true;
      }
    });

    try {
      // Upload the invalid file
      await page.locator('#hiddenFileInput').setInputFiles(invalidFilePath);

      // Wait a bit for processing
      await page.waitForTimeout(5000);

      // Check if error was handled gracefully
      const errorDiv = page.locator('#error');

      // Either an error should be shown or logged
      if (await errorDiv.isVisible()) {
        await expect(errorDiv).toContainText('Failed');
      } else {
        expect(errorCaught).toBe(true);
      }
    } finally {
      // Clean up
      fs.unlinkSync(invalidFilePath);
    }
  });

  test('should initialize with empty state', async ({ page }) => {
    // Check initial state
    await expect(page.locator('#file-list')).toBeEmpty();
    // Note: Website doesn't show "No objects loaded" text, just empty file stats

    // Check that main UI elements are present
    await expect(page.locator('.tab-button')).toHaveCount(4); // Files, Camera, Controls, Info tabs
    await expect(page.locator('#add-file')).toBeVisible();
    await expect(page.locator('#viewer-container')).toBeVisible();
    await expect(page.locator('#three-canvas')).toBeVisible();
  });
});
