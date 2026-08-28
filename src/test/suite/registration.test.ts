import * as assert from 'assert';
import * as THREE from 'three';
import {
  coarseAlign,
  fitCorrespondences,
  icpRefine,
  registerPair,
} from '../../../engine/src/registration';

/**
 * Boundary tests for scan-to-scan registration.
 *
 * The solvers themselves are Rust and are tested there
 * (`wasm/pointcloud-parser/src/registration/tests.rs`, `cargo test`) — eigen
 * decomposition, Cholesky, the grid against brute force, FFT round trips and
 * convergence all live in that suite, and duplicating them here would just be a
 * second copy to keep in sync.
 *
 * What these cover is everything between: that the wasm module actually loads
 * outside a browser, that options marshal into it as the Rust side expects,
 * that a column-major pose comes back without being transposed, and that the
 * stats JSON decodes into the shape the panel reads.
 */

/** Deterministic pseudo-random source, so a failure is always reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const ROOM_WIDTH = 8;
const ROOM_DEPTH = 6;
const ROOM_HEIGHT = 3;

/**
 * A closed room with an asymmetric pillar — the same fixture the Rust suite
 * uses, so a discrepancy between the two points at the boundary rather than at
 * the maths. Z is up, matching the scanner convention.
 */
function makeRoom(pointCount: number, seed = 12345): Float32Array {
  const random = makeRandom(seed);
  const points = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    const u = random();
    const v = random();
    let x = 0;
    let y = 0;
    let z = 0;
    if (i % 11 === 0) {
      x = 5.5 + u * 0.4;
      y = 1.0 + v * 0.4;
      z = random() * ROOM_HEIGHT;
    } else {
      switch (i % 6) {
        case 0:
          [x, y, z] = [u * ROOM_WIDTH, 0, v * ROOM_HEIGHT];
          break;
        case 1:
          [x, y, z] = [u * ROOM_WIDTH, ROOM_DEPTH, v * ROOM_HEIGHT];
          break;
        case 2:
          [x, y, z] = [0, u * ROOM_DEPTH, v * ROOM_HEIGHT];
          break;
        case 3:
          [x, y, z] = [ROOM_WIDTH, u * ROOM_DEPTH, v * ROOM_HEIGHT];
          break;
        case 4:
          [x, y, z] = [u * ROOM_WIDTH, v * ROOM_DEPTH, 0];
          break;
        default:
          [x, y, z] = [u * ROOM_WIDTH, v * ROOM_DEPTH, ROOM_HEIGHT];
          break;
      }
    }
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
  }
  return points;
}

function transformPoints(points: Float32Array, matrix: THREE.Matrix4): Float32Array {
  const out = new Float32Array(points.length);
  const scratch = new THREE.Vector3();
  for (let i = 0; i < points.length; i += 3) {
    scratch.set(points[i], points[i + 1], points[i + 2]).applyMatrix4(matrix);
    out[i] = scratch.x;
    out[i + 1] = scratch.y;
    out[i + 2] = scratch.z;
  }
  return out;
}

/** Largest displacement between corresponding points under two transforms. */
function maxDeviation(
  points: Float32Array,
  a: THREE.Matrix4,
  b: THREE.Matrix4,
  stride = 37
): number {
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  let worst = 0;
  for (let i = 0; i < points.length; i += 3 * stride) {
    pa.set(points[i], points[i + 1], points[i + 2]).applyMatrix4(a);
    pb.set(points[i], points[i + 1], points[i + 2]).applyMatrix4(b);
    worst = Math.max(worst, pa.distanceTo(pb));
  }
  return worst;
}

suite('Registration wasm boundary', () => {
  test('fitCorrespondences returns a usable pose and its residuals', async () => {
    const truth = new THREE.Matrix4()
      .makeRotationFromEuler(new THREE.Euler(0.2, 0.5, -0.3))
      .setPosition(1.5, -2.25, 0.75);
    const source = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0.2, 0.3, 1]);
    const target = transformPoints(source, truth);

    const fit = await fitCorrespondences(source, target);
    assert.ok(fit, 'expected a fit');
    assert.ok((fit!.rmse ?? 1) < 1e-5, `rmse ${fit!.rmse}`);
    assert.ok(fit!.maxError !== null, 'maxError should be reported');
    // A transposed marshal would still look like a valid matrix, so compare
    // the pose's effect rather than its elements.
    assert.ok(maxDeviation(source, fit!.matrix, truth, 1) < 1e-4);
  });

  test('fitCorrespondences reports degenerate input as no result', async () => {
    const degenerate = new Float32Array(9);
    const target = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    assert.strictEqual(await fitCorrespondences(degenerate, target), null);
  });

  test('coarseAlign marshals its options and returns the candidate shortlist', async () => {
    const room = makeRoom(40000, 4);
    const truth = new THREE.Matrix4().makeRotationZ((70 * Math.PI) / 180);
    const source = transformPoints(room, truth);

    const result = await coarseAlign(source, room, {
      upAxis: 'z',
      resolution: 128,
      candidateCount: 4,
    });
    assert.ok(result?.coarse, 'expected coarse stats');
    const coarse = result!.coarse!;
    // The default candidate count is 5, so a shortlist capped at 4 proves the
    // option actually crossed the boundary.
    assert.ok(coarse.candidates.length > 1 && coarse.candidates.length <= 4);
    assert.strictEqual(coarse.candidates[0].yawDegrees, coarse.yawDegrees);
    for (let i = 1; i < coarse.candidates.length; i++) {
      assert.ok(coarse.candidates[i - 1].score >= coarse.candidates[i].score);
      assert.ok(coarse.candidates[i].matrix instanceof THREE.Matrix4);
    }
  });

  test('icpRefine converges from a rough start and reports its stats', async () => {
    const room = makeRoom(40000, 555);
    const truth = new THREE.Matrix4()
      .makeRotationFromEuler(new THREE.Euler(0.02, -0.015, 0.12))
      .setPosition(0.4, -0.3, 0.1);
    const source = transformPoints(room, truth);

    const result = await icpRefine(source, room, { voxelSize: 0.05 });
    assert.ok(result?.icp, 'expected icp stats');
    assert.ok(result!.icp!.fitness > 0.5, `fitness ${result!.icp!.fitness}`);
    assert.ok(result!.icp!.inlierRmse < 0.02, `rmse ${result!.icp!.inlierRmse}`);
    assert.ok(result!.icp!.inlierCount > 0);
    assert.strictEqual(typeof result!.icp!.converged, 'boolean');

    const deviation = maxDeviation(source, result!.matrix, truth.clone().invert());
    assert.ok(deviation < 0.05, `deviation ${deviation.toFixed(4)} m`);
  });

  test('icpRefine honours an initial pose', async () => {
    const room = makeRoom(20000, 91);
    const truth = new THREE.Matrix4().makeTranslation(0.3, -0.2, 0.05);
    const source = transformPoints(room, truth);

    // Started from the answer, ICP should stay there rather than wander.
    const seeded = await icpRefine(source, room, {
      voxelSize: 0.05,
      initial: truth.clone().invert(),
    });
    assert.ok(seeded);
    assert.ok(maxDeviation(source, seeded!.matrix, truth.clone().invert()) < 0.02);
  });

  test('registerPair runs both stages and recovers a station offset', async () => {
    const room = makeRoom(60000, 777);
    const truth = new THREE.Matrix4()
      .makeRotationZ((-64 * Math.PI) / 180)
      .setPosition(-2.3, 1.4, 0.2);
    const source = transformPoints(room, truth);

    const result = await registerPair(source, room, {
      coarse: { upAxis: 'z', resolution: 128 },
      icp: { voxelSize: 0.05 },
    });

    assert.ok(result, 'expected a registration result');
    assert.ok(result!.coarse, 'coarse stage should have run');
    assert.ok(result!.icp, 'icp stage should have run');
    assert.ok(result!.icp!.fitness > 0.5, `fitness ${result!.icp!.fitness}`);
    assert.ok(result!.candidatesTried > 1, 'should have refined several candidates');
    assert.ok(result!.candidateIndex >= 0, 'a coarse candidate should have won');

    const deviation = maxDeviation(source, result!.matrix, truth.clone().invert());
    assert.ok(deviation < 0.05, `deviation ${deviation.toFixed(4)} m`);
  });

  test('registerPair can skip the coarse stage', async () => {
    const room = makeRoom(20000, 12);
    const truth = new THREE.Matrix4().makeTranslation(0.2, 0.1, -0.05);
    const source = transformPoints(room, truth);

    const result = await registerPair(source, room, {
      coarse: false,
      icp: { voxelSize: 0.05 },
    });
    assert.ok(result);
    assert.strictEqual(result!.coarse, null, 'coarse stage should not have run');
    assert.strictEqual(result!.candidateIndex, -1);
    assert.ok(maxDeviation(source, result!.matrix, truth.clone().invert()) < 0.05);
  });

  test('registerPair rejects clouds too small to register', async () => {
    // Two points: below the floor of both stages, so there is no result at all.
    const tiny = new Float32Array(6);
    assert.strictEqual(await registerPair(tiny, tiny, { icp: { voxelSize: 0.05 } }), null);

    // Three coincident points clear the coarse stage's size check but carry no
    // geometry, so refinement finds nothing and says so rather than inventing
    // a fit.
    const degenerate = new Float32Array(9);
    const result = await registerPair(degenerate, degenerate, { icp: { voxelSize: 0.05 } });
    assert.strictEqual(result?.icp ?? null, null, 'ICP must not claim a fit here');
  });
});
