import { test, expect } from '@playwright/test';

test.describe('Error Detection Tests', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Navigate to the test page
    await page.goto('/');

    // Wait for the app to stabilize
    await page.waitForLoadState('networkidle');

    // Give additional time for Svelte to initialize
    await page.waitForTimeout(2000);
  });

  test('should not have Svelte 5 state errors', async ({ page }) => {
    // Check for Symbol($state) errors
    const stateErrors = consoleErrors.filter(
      error =>
        error.includes('Symbol($state)') ||
        error.includes("Cannot use 'in' operator to search for 'Symbol($state)'")
    );

    expect(stateErrors, `Found Svelte state errors: ${stateErrors.join(', ')}`).toHaveLength(0);
  });

  test('should not have ThreeJSViewer import errors', async ({ page }) => {
    // Check for variable reference errors
    const importErrors = consoleErrors.filter(
      error =>
        error.includes("Can't find variable: ThreeJSViewer") ||
        error.includes('ThreeJSViewer is not defined')
    );

    expect(
      importErrors,
      `Found ThreeJSViewer import errors: ${importErrors.join(', ')}`
    ).toHaveLength(0);
  });

  test('should not have props handling errors', async ({ page }) => {
    // Check for props-related errors
    const propsErrors = consoleErrors.filter(
      error =>
        error.includes('props is not an Object') ||
        (error.includes('evaluating') && error.includes('in props'))
    );

    expect(propsErrors, `Found props handling errors: ${propsErrors.join(', ')}`).toHaveLength(0);
  });

  test('should not have lifecycle function errors', async ({ page }) => {
    // Check for lifecycle errors
    const lifecycleErrors = consoleErrors.filter(
      error =>
        error.includes('lifecycle_function_unavailable') ||
        error.includes('mount(...) is not available')
    );

    expect(lifecycleErrors, `Found lifecycle errors: ${lifecycleErrors.join(', ')}`).toHaveLength(
      0
    );
  });

  test('should not have unhandled message type errors', async ({ page }) => {
    // Check for message handling errors
    const messageErrors = consoleErrors.filter(
      error => error.includes('Unhandled message type') || error.includes('webpackOk')
    );

    // Allow webpackOk to be unhandled as it's expected in dev mode
    const criticalMessageErrors = messageErrors.filter(error => !error.includes('webpackOk'));

    expect(
      criticalMessageErrors,
      `Found critical message errors: ${criticalMessageErrors.join(', ')}`
    ).toHaveLength(0);
  });

  test('should successfully mount Svelte app', async ({ page }) => {
    // Wait for the status element to appear (proves app mounted)
    await expect(page.locator('#status-text')).toBeVisible({ timeout: 10000 });

    // Check that status shows Ready or Initializing (both are valid)
    const statusText = await page.locator('#status-text').textContent();
    expect(['Ready', 'Initializing...', 'Error']).toContain(statusText);

    // If status is Error, fail the test
    expect(statusText).not.toBe('Error');
  });

  test('should have working Three.js canvas', async ({ page }) => {
    // Wait for the app to be ready
    await expect(page.locator('#status-text')).toHaveText('Ready', { timeout: 15000 });

    // Check for canvas element
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // Canvas should have WebGL context
    const hasWebGL = await canvas.evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    });

    expect(hasWebGL, 'Canvas should have WebGL context').toBe(true);
  });

  test('should handle file loading simulation', async ({ page }) => {
    // Wait for app to be ready
    await expect(page.locator('#status-text')).toHaveText('Ready', { timeout: 15000 });

    // Clear any existing errors
    consoleErrors.length = 0;

    // Simulate file loading message
    await page.evaluate(() => {
      const sampleData = {
        type: 'fileData',
        fileName: 'test-sample.ply',
        vertices: [
          { x: 0, y: 0, z: 0, red: 255, green: 0, blue: 0, nx: 0, ny: 0, nz: 1 },
          { x: 1, y: 0, z: 0, red: 0, green: 255, blue: 0, nx: 0, ny: 0, nz: 1 },
          { x: 0, y: 1, z: 0, red: 0, green: 0, blue: 255, nx: 0, ny: 0, nz: 1 },
        ],
        faces: [],
        hasColors: true,
        hasNormals: true,
        vertexCount: 3,
        faceCount: 0,
      };

      window.dispatchEvent(new MessageEvent('message', { data: sampleData }));
    });

    // Wait a moment for processing
    await page.waitForTimeout(1000);

    // Check that no errors occurred during file processing
    const fileLoadingErrors = consoleErrors.filter(
      error =>
        !error.includes('webpackOk') && // Ignore webpack dev messages
        !error.includes('Failed to load resource') && // Ignore missing sourcemap warnings
        error.trim().length > 0
    );

    expect(
      fileLoadingErrors,
      `File loading caused errors: ${fileLoadingErrors.join(', ')}`
    ).toHaveLength(0);
  });

  test('comprehensive error summary', async ({ page }) => {
    // This test provides a comprehensive summary of all errors found

    const criticalErrors = consoleErrors.filter(
      error =>
        !error.includes('webpackOk') &&
        !error.includes('Failed to load resource') && // Ignore sourcemap warnings
        !error.includes('.js.map') &&
        error.trim().length > 0
    );

    if (criticalErrors.length > 0) {
      console.log('=== COMPREHENSIVE ERROR SUMMARY ===');
      console.log('Critical Errors Found:');
      criticalErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('=====================================');
    }

    if (consoleWarnings.length > 0) {
      console.log('=== WARNINGS SUMMARY ===');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
      console.log('========================');
    }

    expect(criticalErrors, `Critical errors found: ${criticalErrors.join(' | ')}`).toHaveLength(0);
  });
});
