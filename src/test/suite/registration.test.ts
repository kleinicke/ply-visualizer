import * as assert from 'assert';
import * as THREE from 'three';
import {
  symmetricEigen,
  solveSymmetricPositiveDefinite,
} from '../../../engine/src/registration/linalg';
import { fitRigidTransform } from '../../../engine/src/registration/rigidFit';
import {
  PointGrid,
  estimateNormals,
  robustExtent,
  voxelDownsample,
} from '../../../engine/src/registration/pointIndex';
import { fft2d } from '../../../engine/src/registration/fft';
import { coarseAlign4Dof } from '../../../engine/src/registration/coarseAlign';
import { icpPointToPlane } from '../../../engine/src/registration/icp';
import { registerClouds } from '../../../engine/src/registration';

/** Deterministic pseudo-random source, so a failure is always reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * A closed room: four walls, floor and ceiling, sampled at random. Stands in
 * for the geometry a terrestrial station scan actually contains — large planes
 * in several orientations, which is what makes point-to-plane ICP and the
 * top-down raster behave the way they do on real data.
 *
 * Z is up, matching the scanner convention the coarse stage defaults to.
 */
function makeRoom(pointCount: number, seed = 12345): Float32Array {
  const random = makeRandom(seed);
  const width = 8;
  const depth = 6;
  const height = 3;
  const points = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    const face = i % 6;
    const u = random();
    const v = random();
    let x = 0;
    let y = 0;
    let z = 0;
    switch (face) {
      case 0:
        x = u * width;
        y = 0;
        z = v * height;
        break;
      case 1:
        x = u * width;
        y = depth;
        z = v * height;
        break;
      case 2:
        x = 0;
        y = u * depth;
        z = v * height;
        break;
      case 3:
        x = width;
        y = u * depth;
        z = v * height;
        break;
      case 4:
        x = u * width;
        y = v * depth;
        z = 0;
        break;
      default:
        x = u * width;
        y = v * depth;
        z = height;
        break;
    }
    // A pillar breaks the room's mirror symmetry, so the yaw sweep has a single
    // correct answer rather than two indistinguishable ones.
    if (i % 11 === 0) {
      x = 5.5 + u * 0.4;
      y = 1.0 + v * 0.4;
      z = random() * height;
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

/** Largest distance between corresponding points under two transforms. */
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

suite('Registration linear algebra', () => {
  test('symmetricEigen recovers a known spectrum, sorted descending', () => {
    // diag(3, 2, 1) rotated into a general basis.
    const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3, -0.7, 1.1));
    const R = rotation.elements;
    const basis = [
      [R[0], R[1], R[2]],
      [R[4], R[5], R[6]],
      [R[8], R[9], R[10]],
    ];
    const lambda = [3, 2, 1];
    const A = new Array<number>(9).fill(0);
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          A[i * 3 + j] += lambda[k] * basis[k][i] * basis[k][j];
        }
      }
    }

    const eigen = symmetricEigen(A, 3);
    assert.ok(Math.abs(eigen.values[0] - 3) < 1e-9, `got ${eigen.values[0]}`);
    assert.ok(Math.abs(eigen.values[1] - 2) < 1e-9, `got ${eigen.values[1]}`);
    assert.ok(Math.abs(eigen.values[2] - 1) < 1e-9, `got ${eigen.values[2]}`);

    // Each eigenvector must satisfy A v = lambda v (sign is free).
    for (let k = 0; k < 3; k++) {
      const v = eigen.vectors[k];
      for (let i = 0; i < 3; i++) {
        const av = A[i * 3] * v[0] + A[i * 3 + 1] * v[1] + A[i * 3 + 2] * v[2];
        assert.ok(Math.abs(av - eigen.values[k] * v[i]) < 1e-9);
      }
    }
  });

  test('Cholesky solve matches a known solution and refuses indefinite systems', () => {
    const A = [4, 1, 0, 1, 3, 1, 0, 1, 2];
    const x = [1, -2, 3];
    const b = [0, 1, 2].map(i => A[i * 3] * x[0] + A[i * 3 + 1] * x[1] + A[i * 3 + 2] * x[2]);

    const solved = solveSymmetricPositiveDefinite(A, b, 3);
    assert.ok(solved);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(solved![i] - x[i]) < 1e-9, `component ${i}: ${solved![i]}`);
    }

    assert.strictEqual(solveSymmetricPositiveDefinite([1, 2, 2, 1], [1, 1], 2), null);
  });
});

suite('Registration rigid fit', () => {
  const groundTruth = new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(0.2, 0.5, -0.3))
    .setPosition(1.5, -2.25, 0.75);

  test('recovers an exact transform from four correspondences', () => {
    const source = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0.2, 0.3, 1]);
    const target = transformPoints(source, groundTruth);

    const fit = fitRigidTransform(source, target);
    assert.ok(fit, 'expected a fit');
    assert.ok(fit!.rmse < 1e-6, `rmse ${fit!.rmse}`);
    assert.ok(maxDeviation(source, fit!.matrix, groundTruth, 1) < 1e-5);
  });

  test('produces a rotation, never a reflection', () => {
    // Nearly collinear points: the degenerate case where an SVD-based fit needs
    // a determinant fix-up and can otherwise mirror the cloud.
    const source = new Float32Array([0, 0, 0, 1, 1e-7, 0, 2, -1e-7, 0, 3, 0, 0]);
    const target = transformPoints(source, groundTruth);
    const fit = fitRigidTransform(source, target);
    assert.ok(fit);
    const e = fit!.matrix.elements;
    const determinant = new THREE.Matrix3()
      .set(e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10])
      .determinant();
    assert.ok(Math.abs(determinant - 1) < 1e-6, `determinant ${determinant}`);
  });

  test('averages noise rather than chasing it', () => {
    const room = makeRoom(240, 7);
    const target = transformPoints(room, groundTruth);
    const random = makeRandom(99);
    const noisy = Float32Array.from(target, value => value + (random() - 0.5) * 0.02);

    const fit = fitRigidTransform(room, noisy);
    assert.ok(fit);
    assert.ok(fit!.rmse < 0.02, `rmse ${fit!.rmse}`);
    assert.ok(maxDeviation(room, fit!.matrix, groundTruth) < 0.02);
  });

  test('rejects input it cannot fit', () => {
    assert.strictEqual(
      fitRigidTransform(new Float32Array([0, 0, 0]), new Float32Array([1, 1, 1])),
      null
    );
    assert.strictEqual(
      fitRigidTransform(new Float32Array(9), new Float32Array(12)),
      null,
      'mismatched lengths'
    );
    // All source points coincident: no orientation is recoverable.
    assert.strictEqual(
      fitRigidTransform(new Float32Array(9), new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
      null
    );
  });
});

suite('Registration point index', () => {
  test('voxelDownsample collapses a cell to its mean and keeps distinct cells', () => {
    const points = new Float32Array([0, 0, 0, 0.1, 0.1, 0.1, 0.2, 0, 0, 5, 5, 5]);
    const reduced = voxelDownsample(points, 1);
    assert.strictEqual(reduced.length / 3, 2);
    const cluster = Array.from(reduced.slice(0, 3));
    const far = Array.from(reduced.slice(3, 6));
    const [near, distant] = cluster[0] < 1 ? [cluster, far] : [far, cluster];
    assert.ok(Math.abs(near[0] - 0.1) < 1e-6, `mean x ${near[0]}`);
    assert.ok(Math.abs(distant[0] - 5) < 1e-6);
  });

  test('PointGrid.nearest agrees with brute force and honours its gate', () => {
    const random = makeRandom(4242);
    const count = 4000;
    const points = new Float32Array(count * 3);
    for (let i = 0; i < points.length; i++) {
      points[i] = random() * 10;
    }
    const grid = new PointGrid(points, 0.5);

    for (let trial = 0; trial < 50; trial++) {
      const qx = random() * 10;
      const qy = random() * 10;
      const qz = random() * 10;

      let bestIndex = -1;
      let bestSq = Infinity;
      for (let i = 0; i < count; i++) {
        const dx = points[i * 3] - qx;
        const dy = points[i * 3 + 1] - qy;
        const dz = points[i * 3 + 2] - qz;
        const squared = dx * dx + dy * dy + dz * dz;
        if (squared < bestSq) {
          bestSq = squared;
          bestIndex = i;
        }
      }

      const found = grid.nearest(qx, qy, qz, 2);
      if (Math.sqrt(bestSq) <= 2) {
        assert.strictEqual(found, bestIndex, `trial ${trial}`);
      }
    }

    // Nothing within the gate must report nothing, not the closest miss.
    assert.strictEqual(grid.nearest(1000, 1000, 1000, 1), -1);
  });

  test('estimateNormals finds the plane normal and leaves sparse points at zero', () => {
    const points: number[] = [];
    for (let i = 0; i < 30; i++) {
      for (let j = 0; j < 30; j++) {
        points.push(i * 0.1, j * 0.1, 2);
      }
    }
    // An isolated point far from the plane has no neighborhood to fit.
    points.push(50, 50, 50);
    const data = new Float32Array(points);
    const grid = new PointGrid(data, 0.4);
    const normals = estimateNormals(grid, 0.4);

    const middle = 15 * 30 + 15;
    assert.ok(
      Math.abs(Math.abs(normals[middle * 3 + 2]) - 1) < 1e-5,
      `normal z ${normals[middle * 3 + 2]}`
    );
    const isolated = data.length / 3 - 1;
    assert.strictEqual(normals[isolated * 3], 0);
    assert.strictEqual(normals[isolated * 3 + 1], 0);
    assert.strictEqual(normals[isolated * 3 + 2], 0);
  });
});

suite('Registration robust extent', () => {
  test('describes the dense core, not the long-range tail', () => {
    // A station scan in miniature: a dense 10 m core with a handful of returns
    // reaching 500 m. The bounding box says 1000 m; the useful scale is ~20 m.
    const random = makeRandom(17);
    const points: number[] = [];
    for (let i = 0; i < 20000; i++) {
      points.push((random() - 0.5) * 20, (random() - 0.5) * 20, (random() - 0.5) * 20);
    }
    for (let i = 0; i < 200; i++) {
      points.push((random() - 0.5) * 1000, (random() - 0.5) * 1000, (random() - 0.5) * 1000);
    }
    const extent = robustExtent(new Float32Array(points));
    assert.ok(extent > 10 && extent < 30, `extent ${extent.toFixed(1)}`);
  });
});

suite('Registration FFT', () => {
  test('inverse transform restores the input', () => {
    const n = 8;
    const random = makeRandom(5);
    const original = Float64Array.from({ length: n * n }, () => random());
    const re = Float64Array.from(original);
    const im = new Float64Array(n * n);

    fft2d(re, im, n, false);
    fft2d(re, im, n, true);

    for (let i = 0; i < n * n; i++) {
      assert.ok(Math.abs(re[i] - original[i]) < 1e-9, `index ${i}: ${re[i]} vs ${original[i]}`);
      assert.ok(Math.abs(im[i]) < 1e-9);
    }
  });

  test('a delta transforms to unit magnitude everywhere', () => {
    const n = 8;
    const re = new Float64Array(n * n);
    const im = new Float64Array(n * n);
    re[0] = 1;
    fft2d(re, im, n, false);
    for (let i = 0; i < n * n; i++) {
      assert.ok(Math.abs(Math.hypot(re[i], im[i]) - 1) < 1e-12);
    }
  });
});

suite('Registration coarse 4-DoF alignment', () => {
  test('recovers yaw and translation between two stations', () => {
    const room = makeRoom(60000, 2024);
    const truth = new THREE.Matrix4()
      .makeRotationZ((37 * Math.PI) / 180)
      .setPosition(1.7, -1.1, 0.35);
    // `truth` maps target-frame geometry into the source frame, so the
    // registration answer is its inverse.
    const source = transformPoints(room, truth);

    const result = coarseAlign4Dof(source, room, { upAxis: 'z', resolution: 128 });
    assert.ok(result, 'expected a coarse result');
    assert.ok(result!.score > result!.runnerUpScore, 'winner must beat the runner-up');

    const expected = truth.clone().invert();
    // Cell size on this scene is ~9 cm; the sweep refines yaw to 1 degree, so a
    // couple of cells of residual is the honest tolerance for this stage.
    const deviation = maxDeviation(source, result!.matrix, expected);
    assert.ok(deviation < 0.5, `deviation ${deviation.toFixed(3)} m`);
  });

  test('reports separated yaw candidates, strongest first', () => {
    const room = makeRoom(40000, 4);
    const truth = new THREE.Matrix4().makeRotationZ((70 * Math.PI) / 180);
    const source = transformPoints(room, truth);

    const result = coarseAlign4Dof(source, room, { upAxis: 'z', candidateCount: 4 });
    assert.ok(result);
    assert.ok(result!.candidates.length > 1, 'expected a shortlist');
    assert.ok(result!.candidates.length <= 4);
    // candidates[0] is the reported winner, and the list is sorted.
    assert.strictEqual(result!.candidates[0].yawDegrees, result!.yawDegrees);
    for (let i = 1; i < result!.candidates.length; i++) {
      assert.ok(result!.candidates[i - 1].score >= result!.candidates[i].score);
      // Separated: two entries must not describe the same peak.
      const gap = Math.abs(result!.candidates[i].yawDegrees - result!.candidates[i - 1].yawDegrees);
      assert.ok(Math.min(gap, 360 - gap) > 1, `candidates ${i - 1} and ${i} are the same peak`);
    }
  });

  test('rejects a resolution that is not a power of two', () => {
    const room = makeRoom(100);
    assert.throws(() => coarseAlign4Dof(room, room, { resolution: 100 }), /power of two/);
  });

  test('returns null for clouds too small to raster', () => {
    assert.strictEqual(coarseAlign4Dof(new Float32Array(3), new Float32Array(3)), null);
  });
});

suite('Registration ICP', () => {
  test('converges to the true pose from a rough start', () => {
    const room = makeRoom(40000, 555);
    const truth = new THREE.Matrix4()
      .makeRotationFromEuler(new THREE.Euler(0.02, -0.015, 0.12))
      .setPosition(0.4, -0.3, 0.1);
    const source = transformPoints(room, truth);
    const expected = truth.clone().invert();

    const result = icpPointToPlane(source, room, { voxelSize: 0.05 });
    assert.ok(result, 'expected an ICP result');
    assert.ok(result!.fitness > 0.5, `fitness ${result!.fitness}`);
    assert.ok(result!.inlierRmse < 0.02, `rmse ${result!.inlierRmse}`);

    const deviation = maxDeviation(source, result!.matrix, expected);
    assert.ok(deviation < 0.05, `deviation ${deviation.toFixed(4)} m`);
  });

  test('an already aligned pair stays put', () => {
    const room = makeRoom(20000, 31);
    const result = icpPointToPlane(room, room, { voxelSize: 0.05 });
    assert.ok(result);
    const deviation = maxDeviation(room, result!.matrix, new THREE.Matrix4());
    assert.ok(deviation < 0.01, `drifted ${deviation}`);
  });

  test('reports low fitness when the clouds do not overlap', () => {
    const room = makeRoom(20000, 8);
    const elsewhere = transformPoints(room, new THREE.Matrix4().makeTranslation(500, 500, 500));
    const result = icpPointToPlane(room, elsewhere, { voxelSize: 0.05 });
    // Either no correspondence survives the gate at all, or almost none does.
    assert.ok(result === null || result.fitness < 0.05, `fitness ${result?.fitness}`);
  });

  test('returns null for clouds too small to register', () => {
    assert.strictEqual(icpPointToPlane(new Float32Array(9), new Float32Array(9)), null);
  });
});

suite('Registration end to end', () => {
  test('coarse then ICP recovers a station offset to centimetres', () => {
    const room = makeRoom(60000, 777);
    const truth = new THREE.Matrix4()
      .makeRotationZ((-64 * Math.PI) / 180)
      .setPosition(-2.3, 1.4, 0.2);
    const source = transformPoints(room, truth);
    const expected = truth.clone().invert();

    const result = registerClouds(source, room, {
      coarse: { upAxis: 'z', resolution: 128 },
      icp: { voxelSize: 0.05 },
    });

    assert.ok(result, 'expected a registration result');
    assert.ok(result!.coarse, 'coarse stage should have run');
    assert.ok(result!.icp, 'icp stage should have run');
    assert.ok(result!.icp!.fitness > 0.5, `fitness ${result!.icp!.fitness}`);
    assert.ok(result!.candidatesTried > 1, 'should have refined several candidates');
    assert.ok(result!.candidateIndex >= 0, 'a coarse candidate should have won');

    const deviation = maxDeviation(source, result!.matrix, expected);
    assert.ok(deviation < 0.05, `deviation ${deviation.toFixed(4)} m`);
  });

  test('a single candidate skips the screening pass', () => {
    const room = makeRoom(30000, 21);
    const truth = new THREE.Matrix4().makeRotationZ((15 * Math.PI) / 180);
    const source = transformPoints(room, truth);

    const result = registerClouds(source, room, {
      coarse: { upAxis: 'z' },
      maxCandidates: 1,
      icp: { voxelSize: 0.05 },
    });
    assert.ok(result);
    assert.strictEqual(result!.candidatesTried, 1);
    const deviation = maxDeviation(source, result!.matrix, truth.clone().invert());
    assert.ok(deviation < 0.05, `deviation ${deviation.toFixed(4)} m`);
  });
});
