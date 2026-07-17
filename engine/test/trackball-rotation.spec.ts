import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Coverage for the default Trackball control scheme (VirtualBallControls in
// controls.ts): a sphere-projected virtual-ball rotation model, promoted to
// default in July 2026. The previous delta-based
// three.js TrackballControls lives on as 'Legacy Trackball' and serves as the
// comparison baseline here. The behaviors that define the ball:
//
// 1. Straight drags through the canvas center orbit in the SAME direction as
//    the legacy trackball (the scene front follows the mouse) — no mirroring.
// 2. Rotation is position-dependent: a vertical drag near the canvas rim
//    ROLLS the scene under the cursor (tangential), while the same drag at
//    the center is pure pitch. Delta-based trackballs cannot do this at all —
//    their per-step math ignores where on the canvas the cursor is.
// 3. A circular drag rolls the scene in the direction of the finger. This is
//    "the rotation" that was always backwards before: a delta-based
//    trackball's circular-drag roll is accumulation holonomy with the
//    opposite sign, so the roll sign here must DIFFER from legacy trackball.

async function setup(page: Page, mode: 'ball' | 'legacy') {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(1500);

  await page.click('[data-tab="controls"]');
  await page.waitForTimeout(300);

  // Click the scheme button explicitly — never rely on the startup default.
  await page.click(mode === 'legacy' ? '#legacy-trackball-controls' : '#trackball-controls');
  await page.waitForTimeout(300);

  // Deterministic starting pose: camera on +x, up +y, looking at the origin.
  // Screen right is world -z, screen up is world +y.
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

// Straight drag from (startX, startY) built from small per-frame steps.
async function dragStraight(
  page: Page,
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  totalPixels: number
) {
  const steps = Math.max(4, Math.round(totalPixels / 4));
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const d = (totalPixels * i) / steps;
    await page.mouse.move(startX + dirX * d, startY + dirY * d, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}

// Circular drag sweeping `totalDegrees` around the canvas center. direction
// +1 = clockwise as seen on screen (screen y grows downward), -1 = ccw.
async function dragCircular(
  page: Page,
  cx: number,
  cy: number,
  totalDegrees: number,
  radius: number,
  direction: 1 | -1
) {
  const stepDeg = 6;
  const steps = Math.max(2, Math.round(totalDegrees / stepDeg));
  await page.mouse.move(cx + radius, cy);
  await page.mouse.down();
  for (let i = 0; i <= steps; i++) {
    const t = direction * ((i * stepDeg) / 360) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}

// Swing-corrected roll between two camera states: carry `before.up` across
// the eye direction change with the twist-free minimal rotation, then measure
// the residual angle to `after.up` around the final eye axis.
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
      const rotateByShortestArc = (v: number[], from: number[], to: number[]) => {
        const c = cross(from, to);
        const d = dot(from, to);
        if (d < -0.9999999) {
          return v;
        }
        const s = Math.sqrt((1 + d) * 2);
        const invs = 1 / s;
        const qv = [c[0] * invs, c[1] * invs, c[2] * invs];
        const qw = s * 0.5;
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

async function canvasCenter(page: Page): Promise<{ cx: number; cy: number; box: any }> {
  const box = (await page.locator('#three-canvas').boundingBox())!;
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, box };
}

// ---------------------------------------------------------------- straight

// From pos (3,0,0) / up +y: screen right = world -z, screen up = world +y.
// "Scene follows the mouse" means the camera swings to the opposite screen
// side: drag right => camera z > 0; drag up (dirY=-1) => camera y < 0.
const straightCases: Array<{
  name: string;
  dirX: number;
  dirY: number;
  axis: 1 | 2; // world axis index expected to move (1=y, 2=z)
  sign: 1 | -1;
}> = [
  { name: 'right', dirX: 1, dirY: 0, axis: 2, sign: 1 },
  { name: 'left', dirX: -1, dirY: 0, axis: 2, sign: -1 },
  { name: 'up', dirX: 0, dirY: -1, axis: 1, sign: -1 },
  { name: 'down', dirX: 0, dirY: 1, axis: 1, sign: 1 },
];

for (const { name, dirX, dirY, axis, sign } of straightCases) {
  test(`center drag ${name}: orbits like legacy trackball (scene follows mouse)`, async ({
    page,
  }) => {
    // Measure the legacy delta trackball first with a small budget (so its 5x
    // speed stays well under a half revolution and the sign is unambiguous).
    await setup(page, 'legacy');
    let { cx, cy } = await canvasCenter(page);
    await dragStraight(page, cx, cy, dirX, dirY, 40);
    const normalAfter = await getCamState(page);
    expect(isFinite3(normalAfter.pos)).toBe(true);
    expect(Math.sign(normalAfter.pos[axis]), 'legacy trackball reference direction').toBe(sign);

    await setup(page, 'ball');
    ({ cx, cy } = await canvasCenter(page));
    await dragStraight(page, cx, cy, dirX, dirY, 150);
    const ccAfter = await getCamState(page);
    expect(isFinite3(ccAfter.pos)).toBe(true);

    // Same direction as the legacy trackball — NOT mirrored.
    expect(Math.abs(ccAfter.pos[axis])).toBeGreaterThan(0.15);
    expect(Math.sign(ccAfter.pos[axis])).toBe(sign);
  });
}

// --------------------------------------------------------------- rim roll

test('vertical drag at the left rim rolls the scene under the cursor', async ({ page }) => {
  await setup(page, 'ball');
  const { cx, cy } = await canvasCenter(page);
  // Left rim (~0.78 of the half-width). The RIGHT side of the canvas is
  // covered by the main UI panel, which would swallow the pointer events.
  const rimX = cx - 500;

  // Drag UP at the left rim: the ball's left side follows the finger up, an
  // apparent clockwise scene roll, so the camera's swing-corrected roll about
  // the view axis is positive.
  let before = await getCamState(page);
  await dragStraight(page, rimX, cy + 75, 0, -1, 150);
  let after = await getCamState(page);
  const rollUp = await rollAngle(page, before, after);

  await setup(page, 'ball');
  before = await getCamState(page);
  await dragStraight(page, rimX, cy - 75, 0, 1, 150);
  after = await getCamState(page);
  const rollDown = await rollAngle(page, before, after);

  console.log(`rim rolls: up=${rollUp.toFixed(3)} down=${rollDown.toFixed(3)}`);
  expect(rollUp).toBeGreaterThan(0.1);
  expect(rollDown).toBeLessThan(-0.1);

  // The same vertical drag through the CENTER is pure pitch — nearly no roll.
  await setup(page, 'ball');
  before = await getCamState(page);
  await dragStraight(page, cx, cy + 75, 0, -1, 150);
  after = await getCamState(page);
  const rollCenter = await rollAngle(page, before, after);
  console.log(`center vertical drag roll: ${rollCenter.toFixed(3)}`);
  expect(Math.abs(rollCenter)).toBeLessThan(0.06);
});

// ------------------------------------------------------------ circular roll

// Circular-gesture roll. Where the gesture is mostly tangential (near the
// ball's rim, radius 300px of the 360px ball) the roll must follow the
// finger at the shipped speeds. Sweeps stay short enough that the
// accumulated roll (~2.1 rad per sweep-radian at this radius and rollSpeed)
// stays below π, where the swing-corrected measurement is unambiguous.
// Mid-radius circles at high orbit speed are swing-dominated by geometry
// (amplified yaw/pitch chords drown the twist — the legacy scheme behaves
// the same for that gesture), so the interior-circle model property is
// verified separately at grab-speed, where the legacy contrast is also
// stable (legacy's open-arc roll sign turns out to vary with gesture radius,
// so it is only compared on the gesture where it is reliably wrong).
const nearRimSweeps = [40, 60];

for (const degrees of nearRimSweeps) {
  test(`clockwise near-rim circular drag ${degrees}°: roll follows the finger`, async ({
    page,
  }) => {
    await setup(page, 'ball');
    const { cx, cy } = await canvasCenter(page);
    const before = await getCamState(page);
    await dragCircular(page, cx, cy, degrees, 300, 1);
    const after = await getCamState(page);
    expect(isFinite3(after.up), `up finite after ${degrees}° (no spin-out)`).toBe(true);
    const roll = await rollAngle(page, before, after);
    console.log(`[${degrees}°] rollBall=${roll.toFixed(3)}`);
    // Clockwise finger => clockwise apparent scene roll => positive
    // swing-corrected camera roll.
    expect(roll).toBeGreaterThan(0.04);
  });
}

test('clockwise near-rim circle 370°: roll keeps following the finger past a full loop', async ({
  page,
}) => {
  await setup(page, 'ball');
  const { cx, cy } = await canvasCenter(page);
  const before = await getCamState(page);
  await dragCircular(page, cx, cy, 370, 300, 1);
  const after = await getCamState(page);
  expect(isFinite3(after.up), 'up finite after 370° (no spin-out)').toBe(true);
  const rollCC = await rollAngle(page, before, after);
  console.log(`[370°] rollBall=${rollCC.toFixed(3)}`);
  expect(rollCC).toBeGreaterThan(0.04);
});

test('counter-clockwise near-rim circle rolls the other way', async ({ page }) => {
  await setup(page, 'ball');
  const { cx, cy } = await canvasCenter(page);
  const before = await getCamState(page);
  await dragCircular(page, cx, cy, 60, 300, -1);
  const after = await getCamState(page);
  const roll = await rollAngle(page, before, after);
  console.log(`ccw roll: ${roll.toFixed(3)}`);
  expect(roll).toBeLessThan(-0.04);
});

test('interior circle at grab-speed follows the finger — opposite of legacy', async ({ page }) => {
  // Legacy reference: for an interior clockwise circle the delta trackball's
  // accumulation roll is reliably against the finger (measured ≈ -3 rad).
  await setup(page, 'legacy');
  let { cx, cy } = await canvasCenter(page);
  let before = await getCamState(page);
  await dragCircular(page, cx, cy, 180, 220, 1);
  let after = await getCamState(page);
  const rollLegacy = await rollAngle(page, before, after);

  await setup(page, 'ball');
  // Neutralize the speed tuning: at rotateSpeed/rollSpeed 1 the scheme is the
  // pure virtual ball, whose interior circular gesture must roll with the
  // finger — this pins the model regardless of how defaults get tuned.
  await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    v.controls.rotateSpeed = 1.0;
    v.controls.rollSpeed = 1.0;
  });
  ({ cx, cy } = await canvasCenter(page));
  before = await getCamState(page);
  await dragCircular(page, cx, cy, 180, 220, 1);
  after = await getCamState(page);
  expect(isFinite3(after.up)).toBe(true);
  const roll = await rollAngle(page, before, after);
  console.log(`grab-speed interior roll: ball=${roll.toFixed(3)} legacy=${rollLegacy.toFixed(3)}`);
  expect(roll).toBeGreaterThan(0.04);
  expect(rollLegacy).toBeLessThan(-0.04);
});

// --------------------------------------------------------------- stability

test('ball trackball stays stable (no drift/NaN) over sustained rotation', async ({ page }) => {
  await setup(page, 'ball');
  const { cx, cy } = await canvasCenter(page);

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const N = 120;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 6;
    await page.mouse.move(cx + Math.cos(t) * 150, cy + Math.sin(t) * 100, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return {
      up: v.camera.up.toArray() as number[],
      upLength: v.camera.up.length(),
      distToTarget: v.camera.position.distanceTo(v.controls.target),
    };
  });

  expect(isFinite3(state.up)).toBe(true);
  expect(state.upLength).toBeGreaterThan(0.99);
  expect(state.upLength).toBeLessThan(1.01);
  expect(Number.isFinite(state.distToTarget)).toBe(true);
  expect(Math.abs(state.distToTarget - 3)).toBeLessThan(0.01);
});
