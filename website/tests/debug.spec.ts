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
  const viewerContainer = await page.locator('#viewer-container').count();
  const threeCanvas = await page.locator('#three-canvas').count();
  const statsContainer = await page.locator('#stats-container').count();
  const fileList = await page.locator('#file-list').count();

  console.log('DOM elements found:');
  console.log('- viewer-container:', viewerContainer);
  console.log('- three-canvas:', threeCanvas);
  console.log('- stats-container:', statsContainer);
  console.log('- file-list:', fileList);

  // Check if stats container has content
  const statsText = await page.locator('#stats-container').textContent();
  console.log('Stats container text:', JSON.stringify(statsText));

  // Check if initialization is complete
  const initComplete = await page.evaluate(() => {
    const element = document.getElementById('stats-container');
    return element ? element.innerHTML : 'Element not found';
  });
  console.log('Stats container innerHTML:', initComplete);

  // Take screenshot for debugging
  await page.screenshot({ path: 'test-results/debug-ui.png', fullPage: true });
});
