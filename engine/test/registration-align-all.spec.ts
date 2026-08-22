import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * "Align all to this one" over three clouds of the same room, each dropped at a
 * different yaw and offset the way separate stations of one site are.
 *
 * The anchor must not move, the other two must land on it, and undo must put
 * every one of them back — that last part is what makes the button safe to
 * press on a scene someone has already transformed by hand.
 */

const ROOM_WIDTH = 8;
const ROOM_DEPTH = 6;
const ROOM_HEIGHT = 3;

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Walls, floor, ceiling and an asymmetric pillar, so yaw has one answer. */
function roomPoints(count: number, seed: number): number[][] {
  const random = makeRandom(seed);
  const points: number[][] = [];
  for (let i = 0; i < count; i++) {
    const u = random();
    const v = random();
    if (i % 11 === 0) {
      points.push([5.5 + u * 0.4, 1 + v * 0.4, random() * ROOM_HEIGHT]);
      continue;
    }
    switch (i % 6) {
      case 0:
        points.push([u * ROOM_WIDTH, 0, v * ROOM_HEIGHT]);
        break;
      case 1:
        points.push([u * ROOM_WIDTH, ROOM_DEPTH, v * ROOM_HEIGHT]);
        break;
      case 2:
        points.push([0, u * ROOM_DEPTH, v * ROOM_HEIGHT]);
        break;
      case 3:
        points.push([ROOM_WIDTH, u * ROOM_DEPTH, v * ROOM_HEIGHT]);
        break;
      case 4:
        points.push([u * ROOM_WIDTH, v * ROOM_DEPTH, 0]);
        break;
      default:
        points.push([u * ROOM_WIDTH, v * ROOM_DEPTH, ROOM_HEIGHT]);
        break;
    }
  }
  return points;
}

function yawTranslate(points: number[][], yaw: number, tx: number, ty: number, tz: number) {
  const angle = (yaw * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y, z]) => [cos * x - sin * y + tx, sin * x + cos * y + ty, z + tz]);
}

function writeAsciiPly(file: string, points: number[][]): void {
  const header = [
    'ply',
    'format ascii 1.0',
    `element vertex ${points.length}`,
    'property float x',
    'property float y',
    'property float z',
    'end_header',
  ].join('\n');
  fs.writeFileSync(
    file,
    `${header}\n${points.map(([x, y, z]) => `${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`).join('\n')}\n`
  );
}

/** Worst corner displacement between a candidate 4x4 and an expected mapping. */
function cornerDeviation(m: number[], expected: (p: number[]) => number[]): number {
  const apply = ([x, y, z]: number[]) => [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
  let worst = 0;
  for (const corner of [
    [0, 0, 0],
    [ROOM_WIDTH, 0, 0],
    [0, ROOM_DEPTH, 0],
    [ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT],
  ]) {
    const got = apply(corner);
    const want = expected(corner);
    worst = Math.max(worst, Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]));
  }
  return worst;
}

const inverseOf = (yaw: number, tx: number, ty: number, tz: number) => {
  const angle = (-yaw * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return ([x, y, z]: number[]) => {
    const dx = x - tx;
    const dy = y - ty;
    return [cos * dx - sin * dy, sin * dx + cos * dy, z - tz];
  };
};

test.describe('Align all to one cloud', () => {
  const directory = path.join(os.tmpdir(), `ply-align-all-${process.pid}`);
  const anchorFile = path.join(directory, 'anchor.ply');
  const secondFile = path.join(directory, 'second.ply');
  const thirdFile = path.join(directory, 'third.ply');

  const second = { yaw: 24, tx: 1.2, ty: -0.8, tz: 0.15 };
  const third = { yaw: -47, tx: -1.7, ty: 1.1, tz: -0.2 };

  test.beforeAll(() => {
    fs.mkdirSync(directory, { recursive: true });
    const room = roomPoints(40000, 424242);
    writeAsciiPly(anchorFile, room);
    writeAsciiPly(secondFile, yawTranslate(room, second.yaw, second.tx, second.ty, second.tz));
    writeAsciiPly(thirdFile, yawTranslate(room, third.yaw, third.tx, third.ty, third.tz));
  });

  test.afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('brings both other clouds onto the anchor, and undo puts them back', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);

    await page.locator('#hiddenFileInput').setInputFiles([anchorFile, secondFile, thirdFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(3);

    // File 0 is the anchor; it must not move. Aligning everything is a
    // whole-scene action and lives in the Align menu.
    await page.locator('#global-align-toggle').click();
    await page.locator('#global-align-anchor').selectOption('0');
    await page.locator('.global-align-run').click();

    await expect(page.locator('#global-align-menu .align-summary')).toContainText('2 aligned', {
      timeout: 120_000,
    });
    await expect(page.locator('.global-align-results li')).toHaveCount(2);

    const matrices = await page.evaluate(
      () =>
        (window as any).visualizer.transformationMatrices
          .slice(0, 3)
          .map((m: any) => m.elements.slice()) as number[][]
    );
    expect(cornerDeviation(matrices[0], corner => corner)).toBeLessThan(1e-6);
    expect(
      cornerDeviation(matrices[1], inverseOf(second.yaw, second.tx, second.ty, second.tz))
    ).toBeLessThan(0.05);
    expect(
      cornerDeviation(matrices[2], inverseOf(third.yaw, third.tx, third.ty, third.tz))
    ).toBeLessThan(0.05);

    await page.locator('.global-align-undo').click();
    await expect(page.locator('.global-align-results li')).toHaveCount(0);
    const reverted = await page.evaluate(
      () =>
        (window as any).visualizer.transformationMatrices
          .slice(0, 3)
          .map((m: any) => m.elements.slice()) as number[][]
    );
    for (const matrix of reverted) {
      expect(cornerDeviation(matrix, corner => corner)).toBeLessThan(1e-6);
    }
  });

  /**
   * The complex strategy walks and then settles, so it has to land the same
   * scene as the star pass on a scene the star pass already handles - and it
   * must still leave the anchor untouched.
   */
  test('the complex strategy places every cloud and leaves the anchor alone', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);

    await page.locator('#hiddenFileInput').setInputFiles([anchorFile, secondFile, thirdFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(3);

    await page.locator('#global-align-toggle').click();
    await page.locator('#global-align-anchor').selectOption('0');
    await page.locator('.global-align-complex').check();
    await page.locator('.global-align-run').click();

    await expect(page.locator('#global-align-menu .align-summary')).toContainText('2 aligned', {
      timeout: 180_000,
    });

    const matrices = await page.evaluate(
      () =>
        (window as any).visualizer.transformationMatrices
          .slice(0, 3)
          .map((m: any) => m.elements.slice()) as number[][]
    );
    expect(cornerDeviation(matrices[0], corner => corner)).toBeLessThan(1e-6);
    expect(
      cornerDeviation(matrices[1], inverseOf(second.yaw, second.tx, second.ty, second.tz))
    ).toBeLessThan(0.05);
    expect(
      cornerDeviation(matrices[2], inverseOf(third.yaw, third.tx, third.ty, third.tz))
    ).toBeLessThan(0.05);

    // One undo still covers the whole run, settle pass included.
    await page.locator('.global-align-undo').click();
    const reverted = await page.evaluate(
      () =>
        (window as any).visualizer.transformationMatrices
          .slice(0, 3)
          .map((m: any) => m.elements.slice()) as number[][]
    );
    for (const matrix of reverted) {
      expect(cornerDeviation(matrix, corner => corner)).toBeLessThan(1e-6);
    }
  });

  /**
   * Refine-only skips the yaw sweep, so it can only close a gap ICP can see
   * from where the clouds already sit. Given a small offset it must land on the
   * anchor; the point of the mode is that it is cheap and cannot re-derive a
   * coarse hypothesis that discards a placement the user already trusts.
   */
  test('refine-only closes a small offset without the coarse sweep', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);

    const nudged = path.join(directory, 'nudged.ply');
    const room = roomPoints(40000, 424242);
    writeAsciiPly(nudged, yawTranslate(room, 3, 0.12, -0.09, 0.04));
    await page.locator('#hiddenFileInput').setInputFiles([anchorFile, nudged]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    await page.locator('#global-align-toggle').click();
    await page.locator('.global-align-refine').click();
    // The row appears queued before the solve starts, so waiting for the row
    // would read the matrices mid-run; wait for it to reach a terminal state.
    await expect(page.locator('.global-align-results li')).toHaveCount(1);
    await expect(page.locator('.align-row-aligned')).toHaveCount(1, { timeout: 120_000 });

    const matrices = await page.evaluate(
      () =>
        (window as any).visualizer.transformationMatrices
          .slice(0, 2)
          .map((m: any) => m.elements.slice()) as number[][]
    );
    expect(cornerDeviation(matrices[0], corner => corner)).toBeLessThan(1e-6);
    expect(cornerDeviation(matrices[1], inverseOf(3, 0.12, -0.09, 0.04))).toBeLessThan(0.05);
  });
});
