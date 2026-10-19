import { test, expect } from '@playwright/test';

/**
 * A multi-camera rig JSON (SHOW3D layout: `cams[]` with camera->world `R`,
 * centre `C` and pixel intrinsics) loads as one camera entry rather than
 * failing as an unsupported pose. Generated here: four cameras around the
 * origin, each looking at it.
 */
const cams = [0, 1, 2, 3].map(i => {
  const angle = (i / 4) * Math.PI * 2;
  const centre = [Math.cos(angle), 0.2, Math.sin(angle)];
  const length = Math.hypot(...centre);
  const forward = centre.map(v => -v / length);
  const rightRaw = [-forward[2], 0, forward[0]]; // forward x (0,-1,0)
  const rightLength = Math.hypot(...rightRaw);
  const right = rightRaw.map(v => v / rightLength);
  const down = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
  ];
  return {
    name: `rig${i}`,
    w: 1280,
    h: 1024,
    fx: 450,
    fy: 450,
    cx: 640,
    cy: 512,
    C: centre,
    R: [0, 1, 2].map(r => [right[r], down[r], forward[r]]),
  };
});

test('a camera rig JSON loads as cameras looking at the subject', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'rig.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ source: 'test', cams })),
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Individual cameras \(4\)/ })).toBeVisible();

  const alignment = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return visualizer.cameraGroups[0].children
      .filter((child: any) => child.name.startsWith('camera_'))
      .map((group: any) => {
        group.updateWorldMatrix(true, false);
        const m = group.matrixWorld.elements;
        // Local +Z is the optical axis; it should point back at the origin.
        const forward = [m[8], m[9], m[10]];
        const toOrigin = [-m[12], -m[13], -m[14]];
        const length = Math.hypot(...toOrigin) * Math.hypot(...forward);
        return (
          (forward[0] * toOrigin[0] + forward[1] * toOrigin[1] + forward[2] * toOrigin[2]) / length
        );
      });
  });
  expect(alignment).toHaveLength(4);
  for (const cosine of alignment) {
    expect(cosine).toBeGreaterThan(0.999);
  }

  await page.getByRole('button', { name: /Individual cameras/ }).click();
  await page.getByRole('button', { name: /rig0/ }).click();
  const details = page.locator('.camera-frame-details').first();
  await expect(details).toContainText('camera→world');
  await expect(details).toContainText('1280×1024');
  expect(errors.filter(text => /parse error/i.test(text))).toEqual([]);
});
