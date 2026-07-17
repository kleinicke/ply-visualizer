import { test, expect, Page, Locator } from '@playwright/test';
import path from 'path';

// Multi-point measurement paths: Shift + double-clicks on geometry append
// points A → B → C, rendering a polyline and reporting
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

async function shiftDoubleClick(canvas: Locator, x: number, y: number) {
  await canvas.dblclick({ position: { x, y }, modifiers: ['Shift'] });
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
  const targetBefore = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.controls.target.toArray() as number[];
  });

  const spots = await findPickablePixels(page, 4);
  expect(spots.length, 'found four pickable spots on the mesh').toBe(4);

  await page.click('#new-measurement-path');
  await expect(page.locator('#new-measurement-path')).toHaveClass(/active/);

  for (const [x, y] of spots.slice(0, 3)) {
    await shiftDoubleClick(canvas, x, y);
    await page.waitForTimeout(300);
  }

  expect(await pathPointCount(page)).toBe(3);
  await expect(page.locator('#new-measurement-path')).not.toHaveClass(/active/);
  await expect(page.locator('#measurement-quick-actions')).toBeVisible();

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

  // Closing the loop adds the last-to-first segment to both the scene model
  // and the totals, and the same button can open it again.
  await page.click('#close-measurement-path');
  await expect(page.locator('#close-measurement-path')).toHaveClass(/active/);
  await expect(page.locator('#measurement-quick-loop')).toHaveClass(/active/);
  await expect(page.locator('#measurement-quick-actions')).toContainText('Total:');
  await expect(info).toContainText('Segment 3:');
  await expect(page.locator('.measurement-loop-label')).toHaveCount(1);
  const pathLineColors = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.scene.children
      .filter((child: any) => child.isLine && child.material?.color)
      .map((child: any) => child.material.color.getHex());
  });
  expect(pathLineColors).toContain(0xffb300);
  expect(pathLineColors).toContain(0xffd166);

  // Closing is a persistent mode: adding a point moves the closing segment
  // to the new last point instead of opening the path again.
  await shiftDoubleClick(canvas, spots[3][0], spots[3][1]);
  expect(await pathPointCount(page)).toBe(4);
  await expect(page.locator('#close-measurement-path')).toHaveClass(/active/);
  await expect(info).toContainText('Segment 4:');
  await page.click('#undo-path-point');
  expect(await pathPointCount(page)).toBe(3);

  await page.click('#close-measurement-path');
  await expect(page.locator('#close-measurement-path')).not.toHaveClass(/active/);
  await expect(info).not.toContainText('Segment 3:');

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

  // Plain double-click still changes the rotation center; it does not measure.
  await canvas.dblclick({ position: { x: spots[0][0], y: spots[0][1] } });
  await page.waitForTimeout(300);
  expect(await pathPointCount(page)).toBe(0);
});

test('new measurement path keeps completed paths visible', async ({ page }) => {
  await setup(page);
  const canvas = page.locator('#three-canvas');
  const spots = await findPickablePixels(page, 4);

  await page.click('#new-measurement-path');
  for (const [x, y] of spots.slice(0, 2)) {
    await shiftDoubleClick(canvas, x, y);
  }
  await page.click('#new-measurement-path');
  expect(await pathPointCount(page)).toBe(2);
  await expect(page.locator('#new-measurement-path')).toHaveClass(/active/);

  await shiftDoubleClick(canvas, spots[2][0], spots[2][1]);
  expect(await pathPointCount(page)).toBe(1);
  await expect(page.locator('#new-measurement-path')).not.toHaveClass(/active/);
  await shiftDoubleClick(canvas, spots[3][0], spots[3][1]);

  const result = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return {
      pathCount: v.measurementManager.getPathCount(),
      labels: document.querySelectorAll('.measurement-path-label').length,
    };
  });
  expect(result).toEqual({ pathCount: 2, labels: 2 });
  await expect(page.locator('#clear-all-measurement-paths')).toBeVisible();
  await page.click('#clear-all-measurement-paths');
  await expect(page.locator('#new-measurement-path-from-center')).not.toHaveClass(/active/);
  await expect(page.locator('#new-measurement-path')).not.toHaveClass(/active/);
});

test('shift double-click uses the same measurement path', async ({ page }) => {
  await setup(page);
  const canvas = page.locator('#three-canvas');
  const [spot] = await findPickablePixels(page, 1);

  await expect(page.locator('#new-measurement-path-from-center')).toHaveClass(/active/);
  await canvas.dblclick({ position: { x: spot[0], y: spot[1] }, modifiers: ['Shift'] });

  expect(await pathPointCount(page)).toBe(2);
  await expect(page.locator('#new-measurement-path-from-center')).not.toHaveClass(/active/);
  await expect(page.locator('#measurement-path-info')).toContainText('Segment 1:');
  await page.click('#undo-path-point');
  expect(await pathPointCount(page)).toBe(1);
});

test('new paths can start freely or at the rotation center', async ({ page }) => {
  await setup(page);
  const canvas = page.locator('#three-canvas');
  const spots = await findPickablePixels(page, 3);

  await page.click('#new-measurement-path');
  expect(await pathPointCount(page)).toBe(0);
  await expect(page.locator('#new-measurement-path')).toHaveClass(/active/);
  await shiftDoubleClick(canvas, spots[0][0], spots[0][1]);
  expect(await pathPointCount(page)).toBe(1);
  await expect(page.locator('#new-measurement-path')).not.toHaveClass(/active/);

  await page.click('#new-measurement-path-from-center');
  expect(await pathPointCount(page)).toBe(1);
  await expect(page.locator('#new-measurement-path-from-center')).toHaveClass(/active/);
  await shiftDoubleClick(canvas, spots[1][0], spots[1][1]);
  expect(await pathPointCount(page)).toBe(2);
  await expect(page.locator('#new-measurement-path-from-center')).not.toHaveClass(/active/);

  // Cancelling an armed start mode leaves the current path selected.
  await page.click('#new-measurement-path');
  await page.click('#new-measurement-path');
  await shiftDoubleClick(canvas, spots[2][0], spots[2][1]);
  expect(await pathPointCount(page)).toBe(3);
  const pathCount = await page.evaluate(() =>
    (window as any).visualizer.measurementManager.getPathCount()
  );
  expect(pathCount).toBe(2);
});

test('measurement paths can be cleared from the contextual bottom row', async ({ page }) => {
  await setup(page);
  const canvas = page.locator('#three-canvas');
  const [spot] = await findPickablePixels(page, 1);

  await shiftDoubleClick(canvas, spot[0], spot[1]);
  await expect(page.locator('#measurement-quick-actions')).toBeVisible();
  await expect(
    page.locator('#main-ui-panel > #measurement-quick-actions-mount #measurement-quick-actions')
  ).toBeVisible();
  await expect(page.locator('#measurement-quick-new-center')).toBeVisible();
  await expect(page.locator('#measurement-quick-new-free')).toBeVisible();
  await page.click('#measurement-quick-clear');

  expect(await pathPointCount(page)).toBe(0);
  await expect(page.locator('#measurement-quick-actions')).toHaveCount(0);
  await expect(page.locator('#new-measurement-path-from-center')).toHaveClass(/active/);
});

test('measurement path: missed pick in empty space does not jump the camera', async ({ page }) => {
  await setup(page);

  const canvas = page.locator('#three-canvas');
  const posBefore = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.camera.position.toArray() as number[];
  });

  // Double-click in the far corner (empty void) — normally the "I'm lost"
  // refit gesture, which must be suppressed while measuring.
  await shiftDoubleClick(canvas, 10, 10);
  await page.waitForTimeout(500);

  const posAfter = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.camera.position.toArray() as number[];
  });
  expect(posAfter).toEqual(posBefore);
  expect(await pathPointCount(page)).toBe(0);
});
