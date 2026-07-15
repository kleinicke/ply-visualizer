import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Validates the roll inversion the mathematically correct way: holonomy
// (accumulated roll from a circular drag) is path-dependent, not just a
// function of start/end eye direction - so comparing before/after `up`
// vectors via one big swing-twist decomposition (as an earlier version of
// this test did) is itself invalid once the total rotation gets large,
// exactly the same "ill-conditioned for big angles" issue the production
// code had to work around internally via incremental rebasing.
//
// So this test measures roll the same way the algorithm does: by wrapping
// _rotateCamera and accumulating swing-twist incrementally, frame by frame,
// along the actual path - for BOTH normal and inverse trackball, reading
// whatever `camera.up` actually ends up being each frame. That's an
// apples-to-apples comparison of the real, displayed roll in both modes.

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

// Installs an incremental swing-twist accumulator that observes the real,
// displayed camera eye/up after every _rotateCamera call (whatever the
// active control scheme actually produced) and returns a getter for the
// running total accumulated roll relative to session start.
async function installRollAccumulator(page: Page) {
  await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    const controls: any = v.controls;
    const camera = v.camera;
    const target = v.controls.target;

    const THREE = (window as any).__THREE || (v.camera.constructor as any).__proto__;
    // Plain-number implementation (no THREE import needed in page context).
    const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const norm = (a: number[]) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    };
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a: number[], b: number[]) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const projectPerp = (v3: number[], axis: number[]) => {
      const d = dot(v3, axis);
      return norm([v3[0] - d * axis[0], v3[1] - d * axis[1], v3[2] - d * axis[2]]);
    };
    const signedAngle = (a: number[], b: number[], axis: number[]) => {
      const c = cross(a, b);
      return Math.atan2(dot(c, axis), dot(a, b));
    };
    // Rotate v by the minimal-rotation quaternion carrying `from` to `to`.
    const rotateShortestArc = (v3: number[], from: number[], to: number[]) => {
      const c = cross(from, to);
      const d = dot(from, to);
      if (d < -0.9999999) {return v3;}
      const s = Math.sqrt((1 + d) * 2);
      const invs = 1 / s;
      const qv = [c[0] * invs, c[1] * invs, c[2] * invs];
      const qw = s * 0.5;
      const t = [
        2 * (qv[1] * v3[2] - qv[2] * v3[1]),
        2 * (qv[2] * v3[0] - qv[0] * v3[2]),
        2 * (qv[0] * v3[1] - qv[1] * v3[0]),
      ];
      const qvCrossT = cross(qv, t);
      return [
        v3[0] + qw * t[0] + qvCrossT[0],
        v3[1] + qw * t[1] + qvCrossT[1],
        v3[2] + qw * t[2] + qvCrossT[2],
      ];
    };

    const eyeStart = norm(sub(camera.position.toArray(), target.toArray()));
    const upStart = camera.up.toArray();

    let refEye = eyeStart.slice();
    let refUp = upStart.slice();
    let baseTwistOffset = 0;
    let prevEye = eyeStart.slice();
    let prevUp = upStart.slice();

    const REBASE_THRESHOLD = Math.cos((90 * Math.PI) / 180);

    (window as any).__rollAcc = () => baseTwistOffset + currentTwistSinceBase();

    function currentTwistSinceBase() {
      const eyeNow = norm(sub(camera.position.toArray(), target.toArray()));
      const upTwistFreeNow = rotateShortestArc(refUp, refEye, eyeNow);
      return signedAngle(
        projectPerp(upTwistFreeNow, eyeNow),
        projectPerp(camera.up.toArray(), eyeNow),
        eyeNow
      );
    }

    const originalRotateCamera = controls._rotateCamera.bind(controls);
    controls._rotateCamera = function () {
      originalRotateCamera();
      const eyeNow = norm(sub(camera.position.toArray(), target.toArray()));
      if (dot(refEye, eyeNow) < REBASE_THRESHOLD) {
        const upTwistFreeAtRebase = rotateShortestArc(refUp, refEye, eyeNow);
        const twistSinceLastBase = signedAngle(
          projectPerp(upTwistFreeAtRebase, eyeNow),
          projectPerp(camera.up.toArray(), eyeNow),
          eyeNow
        );
        baseTwistOffset += twistSinceLastBase;
        refEye = eyeNow;
        refUp = camera.up.toArray();
      }
      prevEye = eyeNow;
      prevUp = camera.up.toArray();
    };
  });
}

async function readAccumulatedRoll(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__rollAcc());
}

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

const rollSweeps = [90, 180, 270, 370];

for (const degrees of rollSweeps) {
  test(`accumulated roll inverts (path-correct measurement): circular drag ${degrees} degrees`, async ({
    page,
  }) => {
    const canvas = page.locator('#three-canvas');

    await setup(page, 'trackball');
    await installRollAccumulator(page);
    const box1 = (await canvas.boundingBox())!;
    await dragCircular(page, box1.x + box1.width / 2, box1.y + box1.height / 2, degrees);
    const rollNormal = await readAccumulatedRoll(page);

    await setup(page, 'inverse-trackball-controls');
    await installRollAccumulator(page);
    const box2 = (await canvas.boundingBox())!;
    await dragCircular(page, box2.x + box2.width / 2, box2.y + box2.height / 2, degrees);
    const rollInverse = await readAccumulatedRoll(page);

    console.log(
      `[${degrees}deg] rollNormal=${rollNormal.toFixed(4)} rollInverse=${rollInverse.toFixed(4)}`
    );

    expect(Math.sign(rollNormal)).not.toBe(Math.sign(rollInverse));
    // With a valid path-correct measurement, the inversion should also be
    // close in magnitude (same gesture, same accumulation method) - not just
    // opposite in sign.
    expect(Math.abs(Math.abs(rollNormal) - Math.abs(rollInverse))).toBeLessThan(
      Math.abs(rollNormal) * 0.5 + 0.2
    );
  });
}
