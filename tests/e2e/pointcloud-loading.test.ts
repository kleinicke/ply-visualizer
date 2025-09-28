import { test, expect } from '@playwright/test';

test.describe('Point Cloud Loading Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test page
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Wait for status to show "Ready"
    await expect(page.locator('#status-text')).toHaveText('Ready', { timeout: 10000 });
  });

  test('should load Svelte app successfully', async ({ page }) => {
    // Check that the status shows the app is ready
    await expect(page.locator('#status-text')).toHaveText('Ready');

    // Check that Three.js canvas is created
    await expect(page.locator('#canvas-status')).toHaveText('Found ✅');

    // Verify canvas element exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check canvas dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(100);
    expect(canvasBox?.height).toBeGreaterThan(100);
  });

  test('should load sample_pointcloud.ply successfully', async ({ page }) => {
    // Click the load sample file button
    await page.click('button:has-text("Load Sample PLY")');

    // Wait for the file to load
    await page.waitForTimeout(2000);

    // Check that points were loaded
    const pointsCount = await page.locator('#points-count').textContent();
    expect(parseInt(pointsCount || '0')).toBe(1250);

    // Check console for success messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // Wait a bit for console messages
    await page.waitForTimeout(1000);

    // Should have success messages about adding to scene
    const hasSuccessMessage = consoleMessages.some(
      msg =>
        msg.includes('Successfully added object to scene') || msg.includes('Scene object added')
    );
    expect(hasSuccessMessage).toBe(true);
  });

  test('should handle file data structure correctly', async ({ page }) => {
    // Expose console messages for inspection
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load sample file
    await page.click('button:has-text("Load Sample PLY")');
    await page.waitForTimeout(2000);

    // Check for data structure logging
    const dataStructureMessage = consoleMessages.find(msg =>
      msg.text.includes('File data structure:')
    );
    expect(dataStructureMessage).toBeDefined();

    // Check for geometry creation messages
    const geometryMessage = consoleMessages.some(
      msg => msg.text.includes('vertices') && msg.text.includes('hasColors')
    );
    expect(geometryMessage).toBe(true);
  });

  test('should handle Three.js rendering without errors', async ({ page }) => {
    // Listen for JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    // Load sample file
    await page.click('button:has-text("Load Sample PLY")');
    await page.waitForTimeout(3000);

    // Should not have any JavaScript errors related to Three.js
    const threeJsErrors = jsErrors.filter(
      error =>
        error.toLowerCase().includes('three') ||
        error.toLowerCase().includes('webgl') ||
        error.toLowerCase().includes('canvas')
    );
    expect(threeJsErrors).toHaveLength(0);
  });

  test('should run comprehensive test suite', async ({ page }) => {
    // Run the built-in test function
    const testResults = await page.evaluate(() => {
      return (window as any).runTests();
    });

    expect(testResults).toBeDefined();
    expect(testResults.canvasExists).toBe(true);
    expect(testResults.timestamp).toBeDefined();

    console.log('Test results:', testResults);
  });

  test('should clear scene properly', async ({ page }) => {
    // Load sample file first
    await page.click('button:has-text("Load Sample PLY")');
    await page.waitForTimeout(2000);

    // Verify points are loaded
    let pointsCount = await page.locator('#points-count').textContent();
    expect(parseInt(pointsCount || '0')).toBe(1250);

    // Clear scene
    await page.click('button:has-text("Clear Scene")');
    await page.waitForTimeout(2000);

    // Verify scene is cleared (page reloaded)
    await expect(page.locator('#status-text')).toHaveText('Ready');
    pointsCount = await page.locator('#points-count').textContent();
    expect(parseInt(pointsCount || '0')).toBe(0);
  });

  test('should handle large point clouds efficiently', async ({ page }) => {
    // Measure performance
    const startTime = Date.now();

    // Load sample file
    await page.click('button:has-text("Load Sample PLY")');
    await page.waitForTimeout(5000); // Give more time for large files

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Should load within reasonable time (less than 5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Verify all points loaded
    const pointsCount = await page.locator('#points-count').textContent();
    expect(parseInt(pointsCount || '0')).toBe(1250);
  });
});
