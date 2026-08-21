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

  /**
   * Open the one-pair workspace on `fixedIndex`.
   *
   * It lives in the Align menu now rather than in a file's row: pair correction
   * is still per-file work, but choosing which two clouds to correct is not
   * something to hunt for by expanding rows.
   */
  async function openPairPanel(page: any, fixedIndex = 0) {
    await page.locator('#global-align-toggle').click();
    await page.locator('.align-single-toggle').click();
    await page.locator('#global-align-single-fixed').selectOption(String(fixedIndex));
    return page.locator('#global-align-menu');
  }

  test('the panel appears only once there is something to align against', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles(fixedFile);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
    // One cloud has nothing to align against, so the Align menu is not offered.
    await expect(page.locator('#global-align-toggle')).toHaveCount(0);

    await page.locator('#hiddenFileInput').setInputFiles(movedFile);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await expect(page.locator('#global-align-toggle')).toBeVisible();
    const panel = await openPairPanel(page);
    await expect(panel.locator('.registration-coarse')).toBeVisible();
  });

  test('projection diagnostics are sent as replacement-colour runs', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      visualizer.runningInVSCode = true;
      visualizer.vscode = {
        postMessage: (message: unknown) => ((window as any).__stationMessage = message),
      };
      visualizer.spatialFiles.forEach((data: any, index: number) => {
        data.metadata = {
          ...(data.metadata ?? {}),
          containerFileName: 'Diagnostic.x3a',
          embeddedScanName: `scan_${index}.x3r`,
        };
      });
      visualizer.updateFileList();
    });

    // Colouring the archive — and the diagnostics that vary how — belongs to
    // the whole scene, so it is driven from the Align menu, not a file's panel.
    await page.locator('#global-align-toggle').click();
    await page.locator('.align-options-toggle').click();
    await page.locator('.station-projection-diagnostic').selectOption('reverse-pan');
    await page.locator('.global-align-recolor').click();

    const message = await page.evaluate(() => (window as any).__stationMessage);
    expect(message.type).toBe('stationPipeline');
    expect(message.options.projectionDiagnostic).toBe('reverse-pan');
    expect(message.options.recolorAlreadyColored).toBe(true);
  });

  test('auto-align then refine recovers the station offset, and undo reverts it', async ({
    page,
  }) => {
    test.slow();
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    // File 1 is selected by default as the cloud that moves onto the fixed one.
    const panel = await openPairPanel(page);
    await expect(panel.locator('.registration-coarse')).toBeVisible();

    const before = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(before, corner => corner)).toBeLessThan(1e-6);

    await panel.locator('.registration-coarse').click();
    await expect(page.locator('#file-activity-indicator')).toHaveAttribute(
      'aria-label',
      'Aligning point clouds'
    );
    await expect(panel.locator('.registration-result')).toContainText('Yaw', { timeout: 30_000 });
    await expect(page.locator('#file-activity-indicator')).toHaveCount(0);

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
    const matrixText = await page
      .locator('.file-item')
      .nth(1)
      .locator('textarea[id^="matrix-"]')
      .inputValue();
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

  test('align all emits one phase breakdown to the performance output', async ({ page }) => {
    test.slow();
    const perfLines: string[] = [];
    page.on('console', message => {
      if (message.text().includes('PERF[registration/align-all')) {
        perfLines.push(message.text());
      }
    });
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    await page.locator('#global-align-toggle').click();
    await page.locator('.global-align-run').click();
    await expect(page.locator('#global-align-menu .align-summary')).toContainText('1 aligned', {
      timeout: 60_000,
    });

    expect(perfLines).toHaveLength(1);
    expect(perfLines[0]).toContain('setup ');
    expect(perfLines[0]).toContain('sample ');
    expect(perfLines[0]).toContain('match ');
    expect(perfLines[0]).toContain('apply ');
    expect(perfLines[0]).toContain('| total ');
  });

  test('guided coarse matching isolates each cloud and applies three ordered points', async ({
    page,
  }) => {
    test.slow();
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    const panel = await openPairPanel(page);
    await panel.locator('.registration-needs-coarse').click();
    await expect(page.locator('#file-0')).toBeChecked();
    await expect(page.locator('#file-1')).not.toBeChecked();

    // The guided route takes all three fixed points first, then the same three
    // on the moving cloud. Feed them through the double-click entry point;
    // driving screen coordinates here would test the picker instead.
    const pairs = [
      [0, 0, 0],
      [ROOM_WIDTH, 0, ROOM_HEIGHT],
      [0, ROOM_DEPTH, ROOM_HEIGHT],
    ];
    for (const corner of pairs) {
      const [x, y, z] = corner;
      await page.evaluate(
        fixedPoint => {
          const feature = (window as any).registrationFeature;
          feature.handlePickedPoint((window as any).visualizer, fixedPoint);
        },
        { x, y, z }
      );
    }
    await expect(page.locator('#file-0')).not.toBeChecked();
    await expect(page.locator('#file-1')).toBeChecked();

    for (const corner of pairs) {
      const [x, y, z] = corner;
      const angle = (YAW * Math.PI) / 180;
      const moved = {
        x: Math.cos(angle) * x - Math.sin(angle) * y + TX,
        y: Math.sin(angle) * x + Math.cos(angle) * y + TY,
        z: z + TZ,
      };
      await page.evaluate(movedPoint => {
        const feature = (window as any).registrationFeature;
        feature.handlePickedPoint((window as any).visualizer, movedPoint);
      }, moved);
    }

    await expect(page.locator('#file-0')).toBeChecked();
    await expect(page.locator('#file-1')).toBeChecked();
    await panel.locator('.registration-apply-coarse').click();
    await expect(panel.locator('.registration-result')).toContainText('Coarse match applied');
    await expect(page.locator('#file-0')).toBeChecked();
    await expect(page.locator('#file-1')).not.toBeChecked();

    const after = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(after, expectedInverse)).toBeLessThan(0.01);

    await panel.locator('.registration-finish').click();
    await expect(page.locator('#file-0')).toBeChecked();
    await expect(page.locator('#file-1')).toBeChecked();
  });

  test('fine matching alternates visibility and live-fits after three pairs', async ({ page }) => {
    test.slow();
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    const panel = await openPairPanel(page);
    await panel.locator('.registration-already-coarse').click();

    const pairs = [
      [0, 0, 0],
      [ROOM_WIDTH, 0, ROOM_HEIGHT],
      [0, ROOM_DEPTH, ROOM_HEIGHT],
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
        ({ fixedPoint, movedPoint }) => {
          const feature = (window as any).registrationFeature;
          const visualizer = (window as any).visualizer;
          feature.handlePickedPoint(visualizer, fixedPoint);
          feature.handlePickedPoint(visualizer, movedPoint);
        },
        { fixedPoint: { x, y, z }, movedPoint: moved }
      );
    }

    await expect(panel.locator('.registration-result')).toContainText('Live fit from 3 fine pairs');
    const after = await page.evaluate(
      () => (window as any).visualizer.transformationMatrices[1].elements.slice() as number[]
    );
    expect(cornerDeviation(after, expectedInverse)).toBeLessThan(0.01);
  });

  /**
   * The gesture itself, not the handler behind it.
   *
   * Picking used to claim the plain double-click, which meant that while it was
   * armed the one thing you constantly need — moving the rotation centre to
   * look around for the same corner in the other cloud — was unavailable. It is
   * on ⌘/Ctrl now, and a plain double-click has to stay navigation.
   */
  test('picks on Cmd/Ctrl + double-click and leaves the plain one to navigation', async ({
    page,
  }) => {
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    const panel = await openPairPanel(page);
    await panel.locator('.registration-needs-coarse').click();

    const canvas = page.locator('#three-canvas');
    const box = (await canvas.boundingBox())!;
    const centre = { x: box.width / 2, y: box.height / 2 };

    await canvas.dblclick({ position: centre });
    expect(
      await page.evaluate(() => (window as any).__plyRegistrationState?.coarseFixedCount ?? -1)
    ).toBe(0);

    await canvas.dblclick({ position: centre, modifiers: ['ControlOrMeta'] });
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState?.coarseFixedCount))
      .toBe(1);
  });

  /**
   * A pick answers "where is this feature in this cloud". Drawing the other
   * cloud's answer on top of the one you are searching turns that into a hint
   * in the wrong place — it marks where the feature *will* be after the fit,
   * not where it is now.
   */
  test('shows only the picks belonging to the cloud on screen', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    const panel = await openPairPanel(page);
    await panel.locator('.registration-needs-coarse').click();

    const markerCount = () =>
      page.evaluate(() => {
        const group = (window as any).visualizer.scene.getObjectByName(
          'registration-correspondences'
        );
        if (!group) {
          return { total: 0, colors: [] as string[] };
        }
        const colors: string[] = [];
        group.traverse((object: any) => {
          if (object.isMesh) {
            colors.push('#' + object.material.color.getHexString());
          }
        });
        return { total: colors.length, colors };
      });

    // Two on the fixed cloud, which is still the cloud on screen...
    await page.evaluate(() => {
      const feature = (window as any).registrationFeature;
      const visualizer = (window as any).visualizer;
      for (const point of [
        { x: 0, y: 0, z: 0 },
        { x: 8, y: 0, z: 3 },
      ]) {
        feature.handlePickedPoint(visualizer, point);
      }
    });
    expect((await markerCount()).total).toBe(2);

    // ...the third completes the set and hands over to the moving cloud.
    await page.evaluate(() => {
      (window as any).registrationFeature.handlePickedPoint((window as any).visualizer, {
        x: 0,
        y: 6,
        z: 3,
      });
    });

    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState.workflow))
      .toBe('coarse-moving');
    const onMoving = await markerCount();
    expect(onMoving.total).toBe(0);
  });

  /**
   * Finishing is not discarding.
   *
   * The markers come off the scene so the result can be looked at, but the
   * pairs stay so the work can be continued — and any single pair can be
   * replaced without starting the set again.
   */
  test('finish hides the markers, keeps the pairs, and can re-pick one', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([fixedFile, movedFile]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    const panel = await openPairPanel(page);
    await panel.locator('.registration-already-coarse').click();

    // Three complete pairs, placed through the same entry point the picker uses.
    await page.evaluate(() => {
      const feature = (window as any).registrationFeature;
      const visualizer = (window as any).visualizer;
      const corners = [
        [0, 0, 0],
        [8, 0, 3],
        [0, 6, 3],
      ];
      for (const [x, y, z] of corners) {
        feature.handlePickedPoint(visualizer, { x, y, z });
        feature.handlePickedPoint(visualizer, { x: x + 1.2, y: y - 0.8, z: z + 0.15 });
      }
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState.pairCount))
      .toBe(3);

    const markerCount = () =>
      page.evaluate(() => {
        const group = (window as any).visualizer.scene.getObjectByName(
          'registration-correspondences'
        );
        let count = 0;
        group?.traverse((object: any) => {
          if (object.isMesh) {
            count++;
          }
        });
        return count;
      });
    expect(await markerCount()).toBeGreaterThan(0);

    await panel.locator('.registration-finish').click();
    // Markers gone from the scene, pairs still on the session.
    expect(await markerCount()).toBe(0);
    await expect(panel.locator('.pair-list-row')).toHaveCount(3);

    // Re-picking pair 2 drops it and returns to picking, ready for two points.
    await panel.locator('.registration-recapture[data-pair-index="1"]').click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState.pairCount))
      .toBe(2);
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState.picking))
      .toBe(true);

    // And resuming from a finished state keeps what is left rather than clearing.
    await panel.locator('.registration-finish').click();
    await panel.locator('.registration-resume').click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState.pairCount))
      .toBe(2);
  });
});
