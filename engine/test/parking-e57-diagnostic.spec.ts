import { test } from '@playwright/test';
import path from 'path';

test('diagnose parking E57 load', async ({ page }) => {
  test.setTimeout(180_000);
  page.on('console', message => console.log('BROWSER', message.type(), message.text()));
  page.on('pageerror', error => console.log('PAGEERROR', error.stack || error.message));
  await page.goto('/3d-visualizer/');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles(path.resolve('../testfiles/lidar/e57/parking-lot-updated.e57'));
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => {
      const v: any = (window as any).visualizer;
      return {
        files: v?.spatialFiles?.length,
        meshes: v?.meshes?.length,
        cameras: v?.cameraGroups?.length,
        rows: document.querySelectorAll('#file-list .file-item').length,
        status: document.querySelector('#status')?.textContent,
      };
    });
    console.log('STATE', JSON.stringify(state));
    if (state.files === 19 && state.rows >= 19) {break;}
  }
});
