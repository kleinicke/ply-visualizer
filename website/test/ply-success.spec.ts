import { test, expect } from '@playwright/test';
import path from 'path';

test('PLY file loading works correctly', async ({ page }) => {
  // Path to the test PLY file
  const plyFilePath = path.resolve('../testfiles/open3d/sample_mesh.ply');

  console.log('Testing PLY file:', plyFilePath);

  // Monitor console logs for success indicators
  const loadingMessages: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'log') {
      const text = msg.text();
      loadingMessages.push(text);
      console.log(`Browser log: ${text}`);
    }
  });

  await page.goto('/');

  // Wait for initialization
  await page.waitForTimeout(2000);

  // Verify initial state - visualizer should be initialized
  const visualizerExists = await page.evaluate(() => {
    return typeof (window as any).PointCloudVisualizer !== 'undefined';
  });
  expect(visualizerExists).toBe(true);

  // Load the PLY file
  console.log('Loading PLY file...');
  await page.locator('#hiddenFileInput').setInputFiles(plyFilePath);

  // Wait for processing
  await page.waitForTimeout(5000);

  // Verify the file was processed successfully based on console logs
  const parsingStarted = loadingMessages.some(msg =>
    msg.includes('Parser: Starting PLY/XYZ parsing')
  );
  const parsingCompleted = loadingMessages.some(msg => msg.includes('Parser: Total parse time'));
  const geometryCreated = loadingMessages.some(msg => msg.includes('Render: geometry'));
  const fileProcessed = loadingMessages.some(
    msg => msg.includes('sample_mesh.ply') && msg.includes('faceCount')
  );

  console.log('\n=== PLY LOADING TEST RESULTS ===');
  console.log('✅ PointCloudVisualizer initialized:', visualizerExists);
  console.log('✅ PLY parsing started:', parsingStarted);
  console.log('✅ PLY parsing completed:', parsingCompleted);
  console.log('✅ 3D geometry created:', geometryCreated);
  console.log('✅ File processed correctly:', fileProcessed);

  // All core functionality should work
  expect(parsingStarted).toBe(true);
  expect(parsingCompleted).toBe(true);
  expect(geometryCreated).toBe(true);
  expect(fileProcessed).toBe(true);

  // Check that the file list has been updated
  await expect(page.locator('#file-list')).toContainText('sample_mesh.ply', { timeout: 5000 });

  // Verify 3D canvas exists and is visible
  await expect(page.locator('#three-canvas')).toBeVisible();

  // Take screenshot of the working visualization
  await page.screenshot({ path: 'test-results/ply-working.png', fullPage: true });

  console.log('✅ PLY file loading test PASSED - Core functionality working correctly!');
});
