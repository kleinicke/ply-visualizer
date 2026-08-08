import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Drives the registration panel against the real viewer: two clouds of the same
 * synthetic room, offset by a known yaw and translation the way two X3A
 * stations of one site are, aligned through the buttons a user actually clicks.
 *
 * The solver math is covered headlessly in src/test/suite/registration.test.ts.
 * What this spec is for is the wiring — that the panel appears once a second
 * cloud is loaded, that the result lands in the file's transform matrix, and
 * that undo puts it back.
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

/** Six walls plus an asymmetric pillar, so the yaw sweep has one right answer. */
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

function yawTranslate(
  points: number[][],
  yawDegrees: number,
  tx: number,
  ty: number,
  tz: number
): number[][] {
  const angle = (yawDegrees * Math.PI) / 180;
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
  const body = points.map(([x, y, z]) => `${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
  fs.writeFileSync(file, `${header}\n${body.join('\n')}\n`);
}

/** Worst displacement over the room's corners under a candidate 4x4 (row-major rows). */
function cornerDeviation(matrixColumnMajor: number[], expected: (p: number[]) => number[]): number {
  const m = matrixColumnMajor;
  const apply = ([x, y, z]: number[]) => [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
  const corners = [
    [0, 0, 0],
    [ROOM_WIDTH, 0, 0],
    [0, ROOM_DEPTH, 0],
    [ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT],
  ];
  let worst = 0;
  for (const corner of corners) {
    const got = apply(corner);
    const want = expected(corner);
    worst = Math.max(worst, Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]));
  }
  return worst;
}

test.describe('Scan-to-scan registration', () => {
  // Recreated in beforeAll rather than here: a worker that runs one test,
  // tears down, then picks up another from this file re-runs beforeAll without
  // re-evaluating this scope, and would write into the directory afterAll just
  // deleted.
  const directory = path.join(os.tmpdir(), `ply-registration-${process.pid}`);
  const fixedFile = path.join(directory, 'station-fixed.ply');
  const movedFile = path.join(directory, 'station-moved.ply');

  // The moved station is the fixed one seen from a tripod that turned 31
  // degrees and stepped 1.6 m; aligning it should recover the inverse.
  const YAW = 31;
  const TX = 1.6;
  const TY = -0.9;
  const TZ = 0.25;

  const expectedInverse = ([x, y, z]: number[]) => {
    const angle = (-YAW * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - TX;
    const dy = y - TY;
    return [cos * dx - sin * dy, sin * dx + cos * dy, z - TZ];
  };

  test.beforeAll(() => {
    fs.mkdirSync(directory, { recursive: true });
    const room = roomPoints(40000, 20260808);
    writeAsciiPly(fixedFile, room);
    writeAsciiPly(movedFile, yawTranslate(room, YAW, TX, TY, TZ));
  });

  test.afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
  });

  test('the panel appears only once there is something to align against', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles(fixedFile);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
    await expect(page.locator('.registration-toggle')).toHaveCount(0);

    await page.locator('#hiddenFileInput').setInputFiles(movedFile);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await expect(page.locator('.registration-toggle')).toHaveCount(2);
  });

  test('auto-align then refine recovers the station offset, and undo reverts it', async ({
    page,
  }) => {
    test.slow();
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    // File 1 is the moved station; align it onto file 0, which stays put.
    const panel = page.locator('.file-item').nth(1);
    await panel.locator('.registration-toggle').click();
    await expect(panel.locator('.registration-coarse')).toBeVisible();

    const before = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(before, corner => corner)).toBeLessThan(1e-6);

    await panel.locator('.registration-coarse').click();
    await expect(panel.locator('.registration-result')).toContainText('Yaw', { timeout: 30_000 });

    await panel.locator('.registration-icp').click();
    await expect(panel.locator('.registration-result')).toContainText('overlap', {
      timeout: 60_000,
    });

    const after = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(after, expectedInverse)).toBeLessThan(0.05);

    // The matrix textarea is the user-visible home of the result; it must agree
    // with what the solver put on the file.
    const matrixText = await panel.locator('textarea[id^="matrix-"]').inputValue();
    const values = matrixText.trim().split(/\s+/).map(Number);
    expect(values).toHaveLength(16);
    expect(values[3]).toBeCloseTo(after[12], 3);

    await panel.locator('.registration-undo').click();
    await expect(panel.locator('.registration-result')).toContainText('Reverted');
    const reverted = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(reverted, corner => corner)).toBeLessThan(1e-6);
  });

  test('picking correspondences aligns from three pairs', async ({ page }) => {
    test.slow();
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const panel = page.locator('.file-item').nth(1);
    await panel.locator('.registration-toggle').click();
    await panel.locator('.registration-pick').click();
    await expect(panel.locator('.registration-fit')).toBeDisabled();

    // Feed correspondences through the same entry point the double-click
    // handler uses; driving real clicks would test the picker, not this.
    const pairs = [
      [0, 0, 0],
      [ROOM_WIDTH, 0, ROOM_HEIGHT],
      [0, ROOM_DEPTH, ROOM_HEIGHT],
      [ROOM_WIDTH, ROOM_DEPTH, 0],
    ];
    for (const corner of pairs) {
      const [x, y, z] = corner;
      const angle = (YAW * Math.PI) / 180;
      const moved = {
        x: Math.cos(angle) * x - Math.sin(angle) * y + TX,
        y: Math.sin(angle) * x + Math.cos(angle) * y + TY,
        z: z + TZ,
      };
      await page.evaluate(
        ({ movedPoint, fixedPoint }) => {
          const feature = (window as any).registrationFeature;
          const visualizer = (window as any).visualizer;
          feature.handlePickedPoint(visualizer, movedPoint);
          feature.handlePickedPoint(visualizer, fixedPoint);
        },
        { movedPoint: moved, fixedPoint: { x, y, z } }
      );
    }

    await expect(panel.locator('.registration-fit')).toContainText('(4)');
    await panel.locator('.registration-fit').click();
    await expect(panel.locator('.registration-result')).toContainText('Fitted 4 pairs');

    const after = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(after, expectedInverse)).toBeLessThan(0.01);
  });
});
