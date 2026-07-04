import { test, expect } from '@playwright/test';

test('Debug UI initialization', async ({ page }) => {
  // Capture all console logs
  page.on('console', msg => {
    console.log(`${msg.type()}: ${msg.text()}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
    console.error('Stack:', error.stack);
  });

  // Go to the page
  await page.goto('/');

  // Wait for the page to load
  await page.waitForTimeout(5000);

  // Check if the visualizer was created
  const visualizerExists = await page.evaluate(() => {
    return typeof (window as any).PointCloudVisualizer !== 'undefined';
  });
  console.log('PointCloudVisualizer exists:', visualizerExists);

  // Check DOM structure
  const mainUiPanel = await page.locator('#main-ui-panel').count();
  const threeCanvas = await page.locator('#three-canvas').count();
  const fileStats = await page.locator('#file-stats').count();
  const fileList = await page.locator('#file-list').count();

  console.log('DOM elements found:');
  console.log('- main-ui-panel:', mainUiPanel);
  console.log('- three-canvas:', threeCanvas);
  console.log('- file-stats:', fileStats);
  console.log('- file-list:', fileList);

  // Check if file stats has content (initially empty)
  const statsText = await page.locator('#file-stats').textContent();
  console.log('File stats text:', JSON.stringify(statsText));

  // Check if initialization is complete
  const initComplete = await page.evaluate(() => {
    const element = document.getElementById('file-stats');
    return element ? element.innerHTML : 'Element not found';
  });
  console.log('File stats innerHTML:', initComplete);

  // Take screenshot for debugging
  await page.screenshot({ path: 'test-results/debug-ui.png', fullPage: true });
});
