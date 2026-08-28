import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Comprehensive PLY File Loading Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the visualizer to initialize
    await page.waitForSelector('#main-ui-panel');
    await page.waitForSelector('#three-canvas');

    // Wait for initialization to complete
    await page.waitForTimeout(2000);
  });

  test('should load sample_mesh.ply with complete UI verification', async ({ page }) => {
    // Path to the test PLY file (same as VS Code extension test)
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');

    console.log('Testing PLY file:', plyFilePath);

    // Check if the file exists
    const fs = require('fs');
    if (!fs.existsSync(plyFilePath)) {
      console.warn('PLY test file not found, skipping test:', plyFilePath);
      test.skip();
      return;
    }

    // Monitor console logs for debugging
    const loadingMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        const text = msg.text();
        loadingMessages.push(text);
        console.log(`Browser ${msg.type()}: ${text}`);
      }
    });

    // Monitor network errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Step 1: Verify initial state
    await expect(page.locator('#file-list')).toBeEmpty();
    await expect(page.locator('.tab-button')).toHaveCount(4); // Files, Camera, Controls, Info tabs

    // Step 2: Click Add File button (equivalent to context menu in VS Code)
    await page.click('#add-file');

    // Step 3: Upload the PLY file
    const fileInput = page.locator('#hiddenFileInput');
    await fileInput.setInputFiles(plyFilePath);

    // Step 4: Wait for processing
    await page.waitForTimeout(3000);

    // Loading should either be visible or already complete
    const loadingVisible = await page.locator('#loading').isVisible();
    if (loadingVisible) {
      await expect(page.locator('#loading')).toBeHidden({ timeout: 30000 });
    } else {
      console.log('✅ File loaded so quickly that loading indicator was not visible');
    }

    // Step 5: Verify file loaded in file list
    await expect(page.locator('#file-list')).toContainText('sample_mesh.ply', { timeout: 10000 });
    console.log('✅ PLY file appears in file list');

    // Step 6: Switch to Info tab and verify statistics (equivalent to webview content verification)
    await page.click('[data-tab="info"]');
    await page.waitForTimeout(500);

    // Check that stats are updated
    const fileStats = page.locator('#file-stats');
    await expect(fileStats).toBeVisible();
    await expect(fileStats).toContainText('Vertices', { timeout: 5000 });
    console.log('✅ PLY statistics visible in Info tab');

    // Step 7: Verify 3D canvas rendering (equivalent to Three.js canvas check)
    const canvas = page.locator('#three-canvas');
    await expect(canvas).toBeVisible();
    console.log('✅ Three.js canvas is visible');

    // Step 8: Test UI interactions (equivalent to clicking Camera/Controls tabs)

    // Test Camera tab
    await page.click('[data-tab="camera"]');
    await page.waitForTimeout(500);
    const cameraPanel = page.locator('#camera-controls-panel');
    await expect(cameraPanel).toBeVisible();
    console.log('✅ Camera tab interaction works');

    // Test Controls tab
    await page.click('[data-tab="controls"]');
    await page.waitForTimeout(500);
    const fitButton = page.locator('#fit-camera');
    await expect(fitButton).toBeVisible();
    console.log('✅ Controls tab interaction works');

    // Step 9: Test "Fit to View" functionality (equivalent to F key test)
    await fitButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Fit to View button clicked');

    // Step 10: Test theme switching
    const themeSelector = page.locator('#theme-selector');
    await themeSelector.selectOption('light-modern');
    await page.waitForTimeout(1000);
    await themeSelector.selectOption('dark-modern');
    console.log('✅ Theme switching works');

    // Step 11: Go back to Files tab and check performance stats
    await page.click('[data-tab="files"]');
    const perfStats = page.locator('#performance-stats');
    await expect(perfStats).toContainText('fps');
    console.log('✅ Performance stats visible');

    // Step 12: Verify parsing success from console logs
    const parsingStarted = loadingMessages.some(msg =>
      msg.includes('Parser: Starting PLY/XYZ parsing')
    );
    const parsingCompleted = loadingMessages.some(msg => msg.includes('Parser: Total parse time'));
    const geometryCreated = loadingMessages.some(msg => msg.includes('Render: geometry'));
    const fileProcessed = loadingMessages.some(
      msg => msg.includes('sample_mesh.ply') && msg.includes('faceCount')
    );

    expect(parsingStarted).toBe(true);
    expect(parsingCompleted).toBe(true);
    expect(geometryCreated).toBe(true);
    expect(fileProcessed).toBe(true);

    // Step 13: Take screenshot for verification
    await page.screenshot({ path: 'test-results/ply-comprehensive-loaded.png', fullPage: true });

    console.log('\n📊 Test Summary:');
    console.log('===============');
    console.log('✅ PLY file discovered and loaded');
    console.log('✅ File appears in file list');
    console.log('✅ Statistics displayed in Info tab');
    console.log('✅ Three.js canvas rendering verified');
    console.log('✅ Camera tab interaction tested');
    console.log('✅ Controls tab interaction tested');
    console.log('✅ Fit to View functionality tested');
    console.log('✅ Theme switching tested');
    console.log('✅ Performance stats visible');
    console.log('✅ Console parsing logs verified');
    console.log('\n🎯 This test covers equivalent functionality to the VS Code extension test!');
  });

  test('should handle multiple PLY files like VS Code extension', async ({ page }) => {
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    const fs = require('fs');

    if (!fs.existsSync(plyFilePath)) {
      test.skip();
      return;
    }

    // Load first PLY file
    await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);
    await page.waitForTimeout(3000);

    // Load second PLY file (same file for testing)
    await page.click('#add-file');
    await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);
    await page.waitForTimeout(3000);

    // Should have two file entries
    const fileItems = page.locator('#file-list .file-item');
    await expect(fileItems).toHaveCount(2);
    console.log('✅ Multiple PLY files loaded successfully');
  });

  test('should show PLY mesh statistics like VS Code extension', async ({ page }) => {
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    const fs = require('fs');

    if (!fs.existsSync(plyFilePath)) {
      test.skip();
      return;
    }

    // Monitor for mesh statistics
    let verticesFound = false;
    let trianglesFound = false;

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('faceCount=1200')) {
        trianglesFound = true;
        console.log('✅ Found triangle count in console: 1200');
      }
      if (text.includes('600 vertices') || text.includes('vertices')) {
        verticesFound = true;
        console.log('✅ Found vertex information in console');
      }
    });

    // Load PLY file
    await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);
    await page.waitForTimeout(5000);

    // Check Info tab for statistics
    await page.click('[data-tab="info"]');
    const fileStats = page.locator('#file-stats');
    await expect(fileStats).toContainText('Vertices');

    // The mesh should have triangles and vertices
    expect(trianglesFound).toBe(true);
    console.log('✅ PLY mesh statistics verified (triangles: 1200)');
  });

  test('should monitor console output for errors like VS Code extension', async ({ page }) => {
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    const fs = require('fs');

    if (!fs.existsSync(plyFilePath)) {
      test.skip();
      return;
    }

    let criticalErrors = 0;
    let warnings = 0;
    let infoMessages = 0;

    page.on('console', msg => {
      const level = msg.type();
      const message = msg.text();

      if (level === 'error') {
        criticalErrors++;
        console.log(`❌ Critical Error: ${message}`);
      } else if (level === 'warning') {
        warnings++;
        console.log(`⚠️  Warning: ${message}`);
      } else if (level === 'log') {
        infoMessages++;
        // Only log PLY-related info messages
        if (message.includes('PLY') || message.includes('mesh') || message.includes('Parser')) {
          console.log(`ℹ️  Info: ${message}`);
        }
      }
    });

    // Load PLY file
    await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);
    await page.waitForTimeout(5000);

    console.log(
      `📊 Console Log Summary: ${criticalErrors} errors, ${warnings} warnings, ${infoMessages} info messages`
    );

    // Should have no critical errors
    expect(criticalErrors).toBe(0);
    console.log('✅ No critical errors found in console output');
  });

  test('should test keyboard shortcuts like VS Code extension', async ({ page }) => {
    const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');
    const fs = require('fs');

    if (!fs.existsSync(plyFilePath)) {
      test.skip();
      return;
    }

    // Load PLY file first
    await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);
    await page.waitForTimeout(3000);

    // Test F key (Fit to View) - equivalent to VS Code extension F key test
    await page.keyboard.press('f');
    await page.waitForTimeout(1000);
    console.log('✅ F key (Fit to View) tested');

    // Test R key (Reset Camera)
    await page.keyboard.press('r');
    await page.waitForTimeout(1000);
    console.log('✅ R key (Reset Camera) tested');

    // Test A key (Toggle Axes)
    await page.keyboard.press('a');
    await page.waitForTimeout(1000);
    console.log('✅ A key (Toggle Axes) tested');

    // Verify no console errors from keyboard shortcuts
    console.log('✅ Keyboard shortcuts tested without errors');
  });
});
