import { test, expect } from '@playwright/test';

const ply = Buffer.from(
  'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n'
);

test('long press across the header reorders without activating its controls', async ({ page }) => {
  await page.goto('/');
  await page.locator('#hiddenFileInput').setInputFiles([
    { name: 'first.ply', mimeType: 'application/octet-stream', buffer: ply },
    { name: 'second.ply', mimeType: 'application/octet-stream', buffer: ply },
  ]);
  const rows = page.locator('#file-list [data-entry-id]');
  await expect(rows).toHaveCount(2);
  // Keep both rows within the viewport.
  await page
    .locator('.collapse-toggle')
    .first()
    .click({ modifiers: ['Shift'] });
  const names = page.locator('#file-list .file-name');
  await names.first().click();
  await expect(page.locator('#file-0')).not.toBeChecked();

  // A hold on the remove button is a drag, never a remove action.
  const source = await rows.nth(1).locator('.remove-file').boundingBox();
  const target = await rows.first().boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(target!.x + 50, target!.y + 1, { steps: 5 });
  await page.mouse.up();
  await expect(names).toHaveText(['second.ply', 'first.ply']);
  await expect(page.locator('#file-0')).not.toBeChecked();
  await expect(page.locator('#file-1')).toBeChecked();
  await expect(rows).toHaveCount(2);

  // Escape cancels and suppresses the release click on the filename.
  const first = await names.first().boundingBox();
  const last = await rows.last().boundingBox();
  await page.mouse.move(first!.x + 10, first!.y + 5);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(last!.x + 50, last!.y + last!.height);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(names).toHaveText(['second.ply', 'first.ply']);
  await expect(page.locator('#file-1')).toBeChecked();
  // The next ordinary click still works.
  await names.first().click();
  await expect(page.locator('#file-1')).not.toBeChecked();
});

test('collapsed box borders and padding can start a reorder', async ({ page }) => {
  await page.goto('/');
  await page.locator('#hiddenFileInput').setInputFiles([
    { name: 'first.ply', mimeType: 'application/octet-stream', buffer: ply },
    { name: 'second.ply', mimeType: 'application/octet-stream', buffer: ply },
  ]);
  const rows = page.locator('#file-list [data-entry-id]');
  const names = page.locator('#file-list .file-name');
  await expect(rows).toHaveCount(2);
  await page
    .locator('.collapse-toggle')
    .first()
    .click({ modifiers: ['Shift'] });
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const source = (await rows.last().boundingBox())!;
    const target = (await rows.first().boundingBox())!;
    const x =
      edge === 'left'
        ? source.x + 1
        : edge === 'right'
          ? source.x + source.width - 1
          : source.x + source.width / 2;
    const y =
      edge === 'top'
        ? source.y + 1
        : edge === 'bottom'
          ? source.y + source.height - 1
          : source.y + source.height / 2;
    // Ensure this exercises the outer box, outside the header's content area.
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('file-item'),
        { x, y }
      )
    ).toBe(true);
    const before = await names.allTextContents();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.move(target.x + 30, target.y + 1, { steps: 5 });
    await page.mouse.up();
    await expect(names).toHaveText(before.reverse());
    await expect(page.locator('#file-0')).toBeChecked();
    await expect(page.locator('#file-1')).toBeChecked();
    await expect(page.locator('#file-content-0')).toBeHidden();
    await expect(page.locator('#file-content-1')).toBeHidden();
  }
});
