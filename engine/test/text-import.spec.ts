import { expect, test } from '@playwright/test';

async function open(page, name: string, text: string) {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function positions(page) {
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  return page.evaluate(() => Array.from((window as any).visualizer.spatialFiles[0].positionsArray));
}

test('CSV import detects reordered XYZ headers', async ({ page }) => {
  await open(page, 'points.csv', 'Z,X,Y\n3,1,2\n6,4,5');
  await expect(page.getByLabel('X column')).toHaveValue('2');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await positions(page)).toEqual([1, 2, 3, 4, 5, 6]);
});

test('height grid spacing and holes survive import', async ({ page }) => {
  await open(page, 'heights.tsv', '1\t\t3\t4\n5\t6\t7\t8');
  await page.getByLabel('X spacing').fill('2');
  await page.getByLabel('Y spacing').fill('3');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await positions(page)).toEqual([
    0, 0, 1, 4, 0, 3, 6, 0, 4, 0, 3, 5, 2, 3, 6, 4, 3, 7, 6, 3, 8,
  ]);
});

test('invalid settings can be corrected without reopening the file', async ({ page }) => {
  await open(page, 'grid.txt', '1;2\n3;4');
  await page.getByLabel('Layout').selectOption('xyz');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('selected columns');
  await page.getByLabel('Layout').selectOption('grid');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await positions(page)).toEqual([0, 0, 1, 1, 0, 2, 0, 1, 3, 1, 1, 4]);
});

test('cancel leaves the scene empty and permits another import', async ({ page }) => {
  await open(page, 'points.asc', '1 2 3\n4 5 6');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#file-list .file-item')).toHaveCount(0);
  await page
    .locator('#hiddenFileInput')
    .setInputFiles({ name: 'next.csv', mimeType: 'text/plain', buffer: Buffer.from('7,8,9') });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await positions(page)).toEqual([7, 8, 9]);
});

test('VS Code message route uses the same panel and parser', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).acquireVsCodeApi = () => ({
      postMessage() {},
      getState() {
        return {};
      },
      setState() {},
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page.evaluate(() =>
    window.postMessage(
      {
        type: 'fileData',
        fileName: 'scan.csv',
        data: new TextEncoder().encode('1,2,3\n4,5,6'),
      },
      '*'
    )
  );
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await positions(page)).toEqual([1, 2, 3, 4, 5, 6]);
});

test('an entirely missing grid row keeps its Y position', async ({ page }) => {
  await open(page, 'holes.csv', ',,,\n1,2,3,4');
  await expect(page.getByLabel('Skip header rows')).toHaveValue('0');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await positions(page)).toEqual([0, 1, 1, 1, 1, 2, 2, 1, 3, 3, 1, 4]);
});
