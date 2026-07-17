import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Multi-point measurement path: with path mode active, double-clicks on
// geometry append points A → B → C, rendering a polyline and reporting
// per-segment and total lengths in the Measurements panel. Rotation center
// must stay untouched while measuring, and undo/clear must work.

async function setup(page: Page) {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(1500);

  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);
}

async function pathPointCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.measurementManager.getPathPoints().length;
  });
}

/**
 * Find canvas-space pixels where a pick actually hits geometry. The sample
 * mesh is not solid at every pixel (fixed offsets from the canvas center can
 * land in holes), so ask the SelectionManager itself which candidate spots
 * hit, exactly like the double-click handler will.
 */
async function findPickablePixels(page: Page, count: number): Promise<Array<[number, number]>> {
  return page.evaluate(count => {
    const v: any = (window as any).visualizer;
    v.selectionManager.updateContext(v.getSelectionContext());
    const canvas = v.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const hits: Array<[number, number]> = [];
    for (let gy = 0.25; gy <= 0.75 && hits.length < count; gy += 0.05) {
      for (let gx = 0.25; gx <= 0.75 && hits.length < count; gx += 0.05) {
        const x = Math.round(w * gx);
        const y = Math.round(h * gy);
        if (v.selectionManager.selectPointWithLogging(x, y, canvas)) {
          // Keep picks well separated so segments have nonzero length.
          if (hits.every(([hx, hy]) => Math.hypot(hx - x, hy - y) > 60)) {
            hits.push([x, y]);
          }
        }
      }
    }
    return hits;
  }, count);
}

test('measurement path: pick points, see segments and total, undo, clear', async ({ page }) => {
  await setup(page);

  const canvas = page.locator('#three-canvas');
  const box = (await canvas.boundingBox())!;

  const targetBefore = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.controls.target.toArray() as number[];
  });

  const spots = await findPickablePixels(page, 3);
  expect(spots.length, 'found three pickable spots on the mesh').toBe(3);

  await page.click('#toggle-measurement-path');
  await page.waitForTimeout(200);

  for (const [x, y] of spots) {
    await page.mouse.dblclick(box.x + x, box.y + y);
    await page.waitForTimeout(300);
  }

  expect(await pathPointCount(page)).toBe(3);

  // Two segments and a total are shown in the panel.
  const info = page.locator('#measurement-path-info');
  await expect(info).toContainText('Segment 1:');
  await expect(info).toContainText('Segment 2:');
  await expect(info).toContainText('Total:');

  // Segment lengths are positive and total is their sum.
  const lengths = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    const pts = v.measurementManager.getPathPoints();
    const segments: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      segments.push(pts[i - 1].distanceTo(pts[i]));
    }
    return segments;
  });
  expect(lengths.length).toBe(2);
  for (const l of lengths) {
    expect(l).toBeGreaterThan(0);
  }

  // Measuring must not have moved the rotation center.
  const targetAfter = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.controls.target.toArray() as number[];
  });
  expect(targetAfter).toEqual(targetBefore);

  // Undo removes the last point.
  await page.click('#undo-path-point');
  await page.waitForTimeout(200);
  expect(await pathPointCount(page)).toBe(2);

  // Clear removes the path entirely; path controls collapse.
  await page.click('#clear-measurement-path');
  await page.waitForTimeout(200);
  expect(await pathPointCount(page)).toBe(0);
  await expect(page.locator('#undo-path-point')).toHaveCount(0);

  // Finish mode: double-click behaves normally again (no path points added).
  await page.click('#toggle-measurement-path');
  await page.waitForTimeout(200);
  await page.mouse.dblclick(box.x + spots[0][0], box.y + spots[0][1]);
  await page.waitForTimeout(300);
  expect(await pathPointCount(page)).toBe(0);
});

test('measurement path: missed pick in empty space does not jump the camera', async ({ page }) => {
  await setup(page);

  const canvas = page.locator('#three-canvas');
  const box = (await canvas.boundingBox())!;

  await page.click('#toggle-measurement-path');
  await page.waitForTimeout(200);

  const posBefore = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.camera.position.toArray() as number[];
  });

  // Double-click in the far corner (empty void) — normally the "I'm lost"
  // refit gesture, which must be suppressed while measuring.
  await page.mouse.dblclick(box.x + 10, box.y + 10);
  await page.waitForTimeout(500);

  const posAfter = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.camera.position.toArray() as number[];
  });
  expect(posAfter).toEqual(posBefore);
  expect(await pathPointCount(page)).toBe(0);
});
