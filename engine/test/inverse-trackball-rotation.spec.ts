import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Regression coverage for the inverse-trackball control scheme: it must orbit
// (yaw/pitch, from a straight drag) exactly like normal trackball, and invert
// only the roll (twist from a circular drag) - across the full range a user
// can actually drag, well past a single revolution (370+ degrees), since an
// earlier implementation broke down (started "spinning" erratically) once the
// cumulative rotation passed roughly 180 degrees.

async function setup(page: Page, mode: 'trackball' | 'inverse-trackball-controls') {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(1500);

  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);

  if (mode === 'inverse-trackball-controls') {
    await page.click('#inverse-trackball-controls');
    await page.waitForTimeout(300);
  }

  // Deterministic starting pose so normal vs. inverse comparisons are apples
  // to apples, independent of file-load timing / auto-fit jitter.
  await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    v.controls.target.set(0, 0, 0);
    v.camera.position.set(3, 0, 0);
    v.camera.up.set(0, 1, 0);
    v.camera.lookAt(0, 0, 0);
    v.controls.update();
  });
  await page.waitForTimeout(100);
}

async function getCamState(page: Page) {
  return page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return {
      pos: v.camera.position.toArray() as number[],
      up: v.camera.up.toArray() as number[],
      target: v.controls.target.toArray() as number[],
    };
  });
}

function isFinite3(v: number[]) {
  return v.every(n => Number.isFinite(n));
}

// A long straight drag, built from many small per-frame steps (never one big
// jump) so it stays representative of real per-pixel dragging. `totalPixels`
// controls how far/how much cumulative rotation this induces.
async function dragStraight(
  page: Page,
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  totalPixels: number
) {
  const steps = Math.max(4, Math.round(totalPixels / 4));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const d = (totalPixels * i) / steps;
    await page.mouse.move(cx + dirX * d, cy + dirY * d, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
}

// A circular drag sweeping `totalDegrees` of arc around the canvas center,
// in steps of ~6 degrees (small enough to be a realistic per-frame delta).
async function dragCircular(page: Page, cx: number, cy: number, totalDegrees: number, radius = 60) {
  const stepDeg = 6;
  const steps = Math.max(2, Math.round(totalDegrees / stepDeg));
  await page.mouse.move(cx + radius, cy);
  await page.mouse.down();
  for (let i = 0; i <= steps; i++) {
    const t = ((i * stepDeg) / 360) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function rollAngle(page: Page, before: any, after: any): Promise<number> {
  return page.evaluate(
    ({ before, after }) => {
      const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const norm = (a: number[]) => {
        const l = Math.hypot(a[0], a[1], a[2]);
        return [a[0] / l, a[1] / l, a[2] / l];
      };
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const cross = (a: number[], b: number[]) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const projectOnPlane = (v: number[], n: number[]) => {
        const d = dot(v, n);
        return norm([v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]]);
      };
      // Rotate `v` by the minimal-rotation quaternion that carries `from` to
      // `to` (Rodrigues' rotation formula applied to the half-angle axis).
      const rotateByShortestArc = (v: number[], from: number[], to: number[]) => {
        const c = cross(from, to);
        const d = dot(from, to);
        if (d < -0.9999999) {
          // from/to are (numerically) antipodal - shortest arc is undefined.
          // Not expected for the small before/after eye deltas this test uses.
          return v;
        }
        const s = Math.sqrt((1 + d) * 2);
        const invs = 1 / s;
        const qx = c[0] * invs;
        const qy = c[1] * invs;
        const qz = c[2] * invs;
        const qw = s * 0.5;
        // v' = v + 2*qv x (qv x v + qw*v), the standard quat-rotate-vector formula
        const qv = [qx, qy, qz];
        const t = [
          2 * (qv[1] * v[2] - qv[2] * v[1]),
          2 * (qv[2] * v[0] - qv[0] * v[2]),
          2 * (qv[0] * v[1] - qv[1] * v[0]),
        ];
        return [
          v[0] + qw * t[0] + (qv[1] * t[2] - qv[2] * t[1]),
          v[1] + qw * t[1] + (qv[2] * t[0] - qv[0] * t[2]),
          v[2] + qw * t[2] + (qv[0] * t[1] - qv[1] * t[0]),
        ];
      };

      // Proper (swing-corrected) roll: carry `before.up` across the eye's
      // actual direction change via the twist-free minimal rotation, THEN
      // compare to `after.up` around the final eye axis. Comparing the raw
      // vectors directly (without this swing correction) conflates the
      // orbit's yaw/pitch swing with the roll itself, which is wrong whenever
      // the eye direction changes by more than a small amount between
      // before/after - exactly the case for these multi-hundred-degree drags.
      const eyeBefore = norm(sub(before.pos, before.target));
      const eyeAfter = norm(sub(after.pos, after.target));
      const upBeforeTwistFree = rotateByShortestArc(before.up, eyeBefore, eyeAfter);

      const a = projectOnPlane(upBeforeTwistFree, eyeAfter);
      const b = projectOnPlane(after.up, eyeAfter);
      const c = cross(a, b);
      return Math.atan2(dot(c, eyeAfter), dot(a, b));
    },
    { before, after }
  );
}

const directions: Array<[string, number, number]> = [
  ['right', 1, 0],
  ['left', -1, 0],
  ['up', 0, -1],
  ['down', 0, 1],
];

// pixel budgets roughly corresponding to ~90/180/270/370+ degrees of cumulative
// orbit at rotateSpeed=5 on a normalized-to-canvas-half-width drag.
const pixelBudgets = [40, 90, 150, 220];

for (const [dirName, dirX, dirY] of directions) {
  for (const pixels of pixelBudgets) {
    test(`orbit matches normal trackball: drag ${dirName} ${pixels}px`, async ({ page }) => {
      const canvas = page.locator('#three-canvas');

      await setup(page, 'trackball');
      const box1 = (await canvas.boundingBox())!;
      const before1 = await getCamState(page);
      await dragStraight(
        page,
        box1.x + box1.width / 2,
        box1.y + box1.height / 2,
        dirX,
        dirY,
        pixels
      );
      const afterNormal = await getCamState(page);

      await setup(page, 'inverse-trackball-controls');
      const box2 = (await canvas.boundingBox())!;
      const before2 = await getCamState(page);
      await dragStraight(
        page,
        box2.x + box2.width / 2,
        box2.y + box2.height / 2,
        dirX,
        dirY,
        pixels
      );
      const afterInverse = await getCamState(page);

      expect(before1.pos, 'both runs start from the same deterministic pose').toEqual(before2.pos);
      expect(isFinite3(afterNormal.pos)).toBe(true);
      expect(isFinite3(afterInverse.pos)).toBe(true);

      const dist = Math.hypot(
        afterNormal.pos[0] - afterInverse.pos[0],
        afterNormal.pos[1] - afterInverse.pos[1],
        afterNormal.pos[2] - afterInverse.pos[2]
      );
      // Same drag path -> orbit (eye position) should match normal trackball
      // almost exactly; a generous tolerance absorbs animation-frame timing
      // jitter between the two independent test runs.
      expect(dist).toBeLessThan(0.15);
    });
  }
}

const rollSweeps = [90, 180, 270, 370];

for (const degrees of rollSweeps) {
  test(`roll inverts sign vs normal trackball: circular drag ${degrees} degrees`, async ({
    page,
  }) => {
    const canvas = page.locator('#three-canvas');

    await setup(page, 'trackball');
    const box1 = (await canvas.boundingBox())!;
    const beforeN = await getCamState(page);
    await dragCircular(page, box1.x + box1.width / 2, box1.y + box1.height / 2, degrees);
    const afterN = await getCamState(page);
    expect(isFinite3(afterN.up), `normal trackball up vector finite at ${degrees} degrees`).toBe(
      true
    );
    const rollNormal = await rollAngle(page, beforeN, afterN);

    await setup(page, 'inverse-trackball-controls');
    const box2 = (await canvas.boundingBox())!;
    const beforeI = await getCamState(page);
    await dragCircular(page, box2.x + box2.width / 2, box2.y + box2.height / 2, degrees);
    const afterI = await getCamState(page);
    expect(
      isFinite3(afterI.up),
      `inverse-trackball up vector finite at ${degrees} degrees (no spin-out)`
    ).toBe(true);
    const rollInverse = await rollAngle(page, beforeI, afterI);

    console.log(
      `[${degrees}deg] rollNormal=${rollNormal.toFixed(3)} rollInverse=${rollInverse.toFixed(3)}`
    );

    // The core ask: roll direction must be the mirror image, at every sweep
    // length up to and past a full revolution - not just flip sign near 0 and
    // then break down once the old fixed-reference decomposition would have
    // hit its ~180 degree singularity.
    expect(Math.sign(rollNormal)).not.toBe(Math.sign(rollInverse));
  });
}
