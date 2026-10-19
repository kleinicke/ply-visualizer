import * as assert from 'assert';
import { parseCameraRig } from '../../../engine/src/formats/cameraRig';

type Vec3 = [number, number, number];
type Mat3 = number[][];

/**
 * Ground truth: cameras on a tilted ring around a subject at `target`, each
 * looking at it with +Y down (OpenCV). Every format below is written from
 * these, so a correct reader recovers the same centres and forward axes.
 */
const target: Vec3 = [0.2, -0.1, 0.3];
const truth = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2;
  const centre: Vec3 = [
    target[0] + Math.cos(angle) * 2,
    target[1] - 0.5 + 0.3 * Math.sin(angle * 2),
    target[2] + Math.sin(angle) * 2,
  ];
  const forward = normalize(sub(target, centre));
  const right = normalize(cross(forward, [0, -1, 0]));
  const down = cross(forward, right);
  // Columns are the camera axes in world: camera->world rotation.
  const c2w: Mat3 = [
    [right[0], down[0], forward[0]],
    [right[1], down[1], forward[1]],
    [right[2], down[2], forward[2]],
  ];
  return { name: `cam${i}`, centre, c2w, forward };
});

function assertMatchesTruth(data: unknown, expectedConvention?: RegExp) {
  const cameras = parseCameraRig(data);
  assert.ok(cameras, 'rig should be recognised');
  assert.strictEqual(cameras.length, truth.length);
  cameras.forEach((camera, i) => {
    const r = camera.rotation;
    const forward: Vec3 = [r[2], r[5], r[8]];
    const down: Vec3 = [r[1], r[4], r[7]];
    assertClose(camera.position, truth[i].centre, `${camera.name} centre`);
    assertClose(forward, truth[i].forward, `${camera.name} forward`);
    assertClose(down, [truth[i].c2w[0][1], truth[i].c2w[1][1], truth[i].c2w[2][1]], 'down');
    if (expectedConvention) {
      assert.match(camera.convention, expectedConvention);
    }
  });
  return cameras;
}

suite('Camera rig JSON', () => {
  test('cams[] with camera->world R, centre C and pixel intrinsics (SHOW3D)', () => {
    const cameras = assertMatchesTruth(
      {
        cams: truth.map(t => ({
          name: t.name,
          w: 1280,
          h: 1024,
          fx: 450,
          fy: 451,
          cx: 640,
          cy: 512,
          C: t.centre,
          R: t.c2w,
        })),
      },
      /camera→world.*OpenCV/
    );
    assert.strictEqual(cameras[0].name, 'cam0');
    assert.deepStrictEqual(cameras[0].intrinsics, {
      fx: 450,
      fy: 451,
      cx: 640,
      cy: 512,
      imageWidth: 1280,
      imageHeight: 1024,
    });
  });

  test('infers world->camera when the same R + C is stored transposed', () => {
    assertMatchesTruth(
      { cams: truth.map(t => ({ name: t.name, C: t.centre, R: transpose(t.c2w) })) },
      /world→camera.*\(inferred\)/
    );
  });

  test('cameras[] with K and world->camera R, t (Panoptic / OpenCV)', () => {
    const cameras = assertMatchesTruth({
      cameras: truth.map(t => {
        const r = transpose(t.c2w);
        const tvec = mul(r, t.centre).map(v => -v);
        return {
          name: t.name,
          resolution: [1920, 1080],
          K: [
            [1000, 0, 960],
            [0, 1000, 540],
            [0, 0, 1],
          ],
          R: r,
          t: tvec.map(v => [v]),
        };
      }),
    });
    assert.strictEqual(cameras[0].intrinsics?.cx, 960);
  });

  test('NeRF transforms.json: OpenGL camera->world matrices and shared camera_angle_x', () => {
    const cameras = assertMatchesTruth(
      {
        camera_angle_x: 2 * Math.atan(400 / 500),
        w: 800,
        h: 600,
        frames: truth.map(t => {
          // OpenGL camera: X right, Y up, looking down -Z.
          const m = t.c2w.map(row => [row[0], -row[1], -row[2]]);
          return {
            file_path: `./images/${t.name}.png`,
            transform_matrix: [
              [...m[0], t.centre[0]],
              [...m[1], t.centre[1]],
              [...m[2], t.centre[2]],
              [0, 0, 0, 1],
            ],
          };
        }),
      },
      /OpenGL/
    );
    assert.strictEqual(cameras[0].name, 'cam0.png');
    assert.ok(Math.abs(cameras[0].intrinsics!.fx - 500) < 1e-9);
  });

  test('COLMAP-style qvec (w, x, y, z) and tvec keyed by camera name', () => {
    const cameras: Record<string, unknown> = {};
    for (const t of truth) {
      const r = transpose(t.c2w);
      cameras[t.name] = {
        qvec: quaternionWxyz(r),
        tvec: mul(r, t.centre).map(v => -v),
      };
    }
    const parsed = assertMatchesTruth({ cameras }, /world→camera/);
    assert.strictEqual(parsed[2].name, 'cam2');
  });

  test('leaves pose and other JSON to their own readers', () => {
    assert.strictEqual(parseCameraRig({ joints: [{ x: 0, y: 0, z: 0 }], edges: [] }), null);
    assert.strictEqual(parseCameraRig({ positions_3d: [[0, 0, 0]] }), null);
    assert.strictEqual(
      parseCameraRig([
        [0, 0, 0],
        [1, 1, 1],
      ]),
      null
    );
    assert.strictEqual(parseCameraRig({ points: [{ x: 1, y: 2, z: 3 }] }), null);
    assert.strictEqual(parseCameraRig({ cameras: { a: { position: [0, 0, 0] } } }), null);
  });
});

function assertClose(actual: number[], expected: number[], label: string) {
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) < 1e-6,
      `${label}: got ${actual.join(', ')}, expected ${expected.join(', ')}`
    );
  }
}

function quaternionWxyz(m: Mat3): number[] {
  const w = Math.sqrt(Math.max(0, 1 + m[0][0] + m[1][1] + m[2][2])) / 2;
  const x = Math.sqrt(Math.max(0, 1 + m[0][0] - m[1][1] - m[2][2])) / 2;
  const y = Math.sqrt(Math.max(0, 1 - m[0][0] + m[1][1] - m[2][2])) / 2;
  const z = Math.sqrt(Math.max(0, 1 - m[0][0] - m[1][1] + m[2][2])) / 2;
  return [
    w,
    Math.sign(m[2][1] - m[1][2]) * x,
    Math.sign(m[0][2] - m[2][0]) * y,
    Math.sign(m[1][0] - m[0][1]) * z,
  ];
}

function transpose(m: Mat3): Mat3 {
  return [0, 1, 2].map(r => [0, 1, 2].map(c => m[c][r]));
}

function mul(m: Mat3, v: number[]): number[] {
  return m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}
