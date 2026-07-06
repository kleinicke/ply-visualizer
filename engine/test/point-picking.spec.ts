import { test, expect, Page } from '@playwright/test';

/**
 * Regression tests for double-click point picking (SelectionManager).
 *
 * The old raycast-based picker degenerated when zoomed far out: the world-space
 * threshold grew with distance until every point intersected the ray, freezing
 * the UI for seconds on large clouds. The screen-space picker must stay fast
 * regardless of how many points land near the cursor.
 */

const POINT_COUNT = 2_000_000;

/** Build a binary little-endian PLY point cloud (positions + colors) */
function buildLargePly(pointCount: number): Buffer {
  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    `element vertex ${pointCount}\n` +
    'property float x\n' +
    'property float y\n' +
    'property float z\n' +
    'property uchar red\n' +
    'property uchar green\n' +
    'property uchar blue\n' +
    'end_header\n';

  const headerBytes = Buffer.from(header, 'ascii');
  const stride = 15; // 3 * float32 + 3 * uint8
  const body = Buffer.alloc(pointCount * stride);

  // Deterministic pseudo-random points inside a unit cube
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let i = 0; i < pointCount; i++) {
    const offset = i * stride;
    body.writeFloatLE(rand() * 2 - 1, offset);
    body.writeFloatLE(rand() * 2 - 1, offset + 4);
    body.writeFloatLE(rand() * 2 - 1, offset + 8);
    body.writeUInt8((rand() * 255) | 0, offset + 12);
    body.writeUInt8((rand() * 255) | 0, offset + 13);
    body.writeUInt8((rand() * 255) | 0, offset + 14);
  }

  return Buffer.concat([headerBytes, body]);
}

async function loadPly(page: Page, buffer: Buffer, name: string): Promise<void> {
  await page.click('#add-file');
  await page.locator('#hiddenFileInput').setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer,
  });

  const loading = page.locator('#loading');
  if (await loading.isVisible()) {
    await expect(loading).toBeHidden({ timeout: 60000 });
  }
  // Allow chunked geometry upload and first render to settle
  await page.waitForTimeout(3000);
}

/**
 * Dispatch a synthetic dblclick at canvas-relative coordinates and measure how
 * long the (synchronous) handler blocks the main thread.
 */
async function timedDoubleClick(page: Page, relX: number, relY: number): Promise<number> {
  return page.evaluate(
    ({ relX, relY }) => {
      const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const event = new MouseEvent('dblclick', {
        bubbles: true,
        clientX: rect.left + rect.width * relX,
        clientY: rect.top + rect.height * relY,
      });
      const start = performance.now();
      canvas.dispatchEvent(event);
      return performance.now() - start;
    },
    { relX, relY }
  );
}

test.describe('Double-click point picking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(2000);
  });

  test('picks a point and stays fast when zoomed far out', async ({ page }) => {
    test.setTimeout(180000);

    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await loadPly(page, buildLargePly(POINT_COUNT), 'picking_perf.ply');

    // Sanity: pick works at the default (fitted) zoom level
    logs.length = 0;
    const zoomedInMs = await timedDoubleClick(page, 0.5, 0.5);
    expect(logs.join('\n')).toContain('screen-space pick');
    console.log(`Zoomed-in pick handler time: ${zoomedInMs.toFixed(1)}ms`);

    // Zoom far out so the whole cloud collapses into a few pixels. This was
    // the pathological case for the raycast picker (multi-second freeze).
    const canvas = page.locator('#three-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    logs.length = 0;
    const zoomedOutMs = await timedDoubleClick(page, 0.5, 0.5);
    console.log(`Zoomed-out pick handler time: ${zoomedOutMs.toFixed(1)}ms`);

    expect(logs.join('\n')).toContain('screen-space pick');
    // 2M points; the old implementation took seconds here. Generous CI bound.
    expect(zoomedOutMs).toBeLessThan(1000);
  });

  test('near-miss stays inert; double-click far into empty space refits the view', async ({
    page,
  }) => {
    test.setTimeout(120000);

    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await loadPly(page, buildLargePly(10_000), 'picking_miss.ply');

    // Zoom out so the cloud shrinks to a small blob in the center
    const canvas = page.locator('#three-canvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // A miss close to the cloud must not move the camera (failed pick, not
    // a recovery gesture)
    logs.length = 0;
    await timedDoubleClick(page, 0.5 + 80 / box!.width, 0.5);
    let output = logs.join('\n');
    expect(output).toContain('No selectable object found');
    expect(output).not.toContain('fitting view to all objects');

    // A double-click far from everything is the recovery gesture
    logs.length = 0;
    await timedDoubleClick(page, 0.02, 0.02);
    expect(logs.join('\n')).toContain('fitting view to all objects');
    await page.waitForTimeout(500);

    // After the refit the cloud fills the view again and picking works
    logs.length = 0;
    await timedDoubleClick(page, 0.5, 0.5);
    output = logs.join('\n');
    expect(output).toContain('screen-space pick');
  });
});
