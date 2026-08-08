/**
 * Closed-form absolute orientation: the rigid transform that best maps a set of
 * source points onto their corresponding target points.
 *
 * Horn's unit-quaternion method rather than an SVD of the covariance. Both give
 * the same answer for well-posed input, but the quaternion form cannot return a
 * reflection, so there is no determinant fix-up branch to get wrong when the
 * user picks three nearly collinear correspondences.
 *
 * Used directly by manual pair picking, and as the inner solve of the ICP
 * point-to-point fallback.
 */

import * as THREE from 'three';
import { symmetricEigen } from './linalg';

export interface RigidFitResult {
  /** Maps source into target. */
  matrix: THREE.Matrix4;
  /** Root-mean-square residual over the correspondences, in scene units. */
  rmse: number;
  /** Largest single correspondence residual — the one to show the user. */
  maxError: number;
}

/**
 * @param source Flat xyz triples.
 * @param target Flat xyz triples, same length and ordering as `source`.
 * @param weights Optional per-correspondence weight, length `source.length / 3`.
 * @returns null when there are fewer than three pairs, the lengths disagree, or
 *   the configuration is degenerate (all points coincident).
 */
export function fitRigidTransform(
  source: ArrayLike<number>,
  target: ArrayLike<number>,
  weights?: ArrayLike<number>
): RigidFitResult | null {
  const count = Math.floor(source.length / 3);
  if (count < 3 || source.length !== target.length || source.length % 3 !== 0) {
    return null;
  }

  let totalWeight = 0;
  const sourceCentroid = [0, 0, 0];
  const targetCentroid = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const w = weights ? weights[i] : 1;
    if (!(w > 0)) {
      continue;
    }
    totalWeight += w;
    for (let axis = 0; axis < 3; axis++) {
      sourceCentroid[axis] += w * source[i * 3 + axis];
      targetCentroid[axis] += w * target[i * 3 + axis];
    }
  }
  if (!(totalWeight > 0)) {
    return null;
  }
  for (let axis = 0; axis < 3; axis++) {
    sourceCentroid[axis] /= totalWeight;
    targetCentroid[axis] /= totalWeight;
  }

  // Cross-covariance S[a][b] = sum w * source_a * target_b, mean-centered.
  const S = new Array<number>(9).fill(0);
  let sourceSpread = 0;
  for (let i = 0; i < count; i++) {
    const w = weights ? weights[i] : 1;
    if (!(w > 0)) {
      continue;
    }
    const sx = source[i * 3] - sourceCentroid[0];
    const sy = source[i * 3 + 1] - sourceCentroid[1];
    const sz = source[i * 3 + 2] - sourceCentroid[2];
    const tx = target[i * 3] - targetCentroid[0];
    const ty = target[i * 3 + 1] - targetCentroid[1];
    const tz = target[i * 3 + 2] - targetCentroid[2];
    sourceSpread += w * (sx * sx + sy * sy + sz * sz);
    S[0] += w * sx * tx;
    S[1] += w * sx * ty;
    S[2] += w * sx * tz;
    S[3] += w * sy * tx;
    S[4] += w * sy * ty;
    S[5] += w * sy * tz;
    S[6] += w * sz * tx;
    S[7] += w * sz * ty;
    S[8] += w * sz * tz;
  }
  if (!(sourceSpread > 0)) {
    return null;
  }

  const [Sxx, Sxy, Sxz, Syx, Syy, Syz, Szx, Szy, Szz] = S;
  // Horn's symmetric 4x4 profile matrix. Its largest eigenvector is the
  // quaternion (w, x, y, z) of the optimal rotation.
  const N = [
    Sxx + Syy + Szz,
    Syz - Szy,
    Szx - Sxz,
    Sxy - Syx,

    Syz - Szy,
    Sxx - Syy - Szz,
    Sxy + Syx,
    Szx + Sxz,

    Szx - Sxz,
    Sxy + Syx,
    -Sxx + Syy - Szz,
    Syz + Szy,

    Sxy - Syx,
    Szx + Sxz,
    Syz + Szy,
    -Sxx - Syy + Szz,
  ];

  const eigen = symmetricEigen(N, 4);
  const q = eigen.vectors[0];
  const quaternion = new THREE.Quaternion(q[1], q[2], q[3], q[0]);
  if (quaternion.lengthSq() < 1e-12) {
    return null;
  }
  quaternion.normalize();

  const rotation = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  const rotatedCentroid = new THREE.Vector3(
    sourceCentroid[0],
    sourceCentroid[1],
    sourceCentroid[2]
  ).applyMatrix4(rotation);

  const matrix = rotation.clone();
  matrix.setPosition(
    targetCentroid[0] - rotatedCentroid.x,
    targetCentroid[1] - rotatedCentroid.y,
    targetCentroid[2] - rotatedCentroid.z
  );

  let squaredSum = 0;
  let maxError = 0;
  const scratch = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    scratch.set(source[i * 3], source[i * 3 + 1], source[i * 3 + 2]).applyMatrix4(matrix);
    const dx = scratch.x - target[i * 3];
    const dy = scratch.y - target[i * 3 + 1];
    const dz = scratch.z - target[i * 3 + 2];
    const squared = dx * dx + dy * dy + dz * dz;
    squaredSum += squared;
    maxError = Math.max(maxError, Math.sqrt(squared));
  }

  return { matrix, rmse: Math.sqrt(squaredSum / count), maxError };
}
