/**
 * Point-to-plane ICP refinement.
 *
 * Point-to-plane rather than point-to-point because the geometry these scans
 * contain is mostly planar. With a point-to-point cost, two overlapping views of
 * a flat wall are free to slide along it — the residual barely changes — so the
 * solver converges slowly and to whatever the initial guess happened to favour.
 * Projecting the residual onto the surface normal removes exactly that free
 * direction, which is why it typically converges in tens of iterations instead
 * of hundreds.
 *
 * The step is a Gauss-Newton solve on the small-angle parameterization: for a
 * source point `p`, target point `q` and target normal `n`, the linearized
 * residual is `n·(p−q) + (p×n)·ω + n·t`, so each correspondence contributes the
 * 6-vector `[p×n, n]` and the whole update is one 6x6 symmetric system.
 */

import * as THREE from 'three';
import { PointGrid, estimateNormals, robustExtent, voxelDownsample } from './pointIndex';
import { solveSymmetricPositiveDefinite } from './linalg';

export interface IcpOptions {
  /** Starting pose; identity when omitted. */
  initial?: THREE.Matrix4;
  /**
   * Finest downsample cell, in scene units. Defaults to 1/400 of the smaller
   * cloud's robust working diameter (see `robustExtent`), which lands near 4 cm
   * on a typical station scan.
   */
  voxelSize?: number;
  /** Coarse-to-fine multipliers applied to `voxelSize`, largest first. */
  scales?: number[];
  /** Correspondence gate as a multiple of the current scale's cell size. */
  gateFactor?: number;
  /** Fraction of the closest correspondences kept each iteration. */
  trimRatio?: number;
  maxIterationsPerScale?: number;
  /**
   * Caps on the working set per scale, applied after voxel downsampling.
   *
   * A fine voxel on a dense station scan still leaves hundreds of thousands of
   * points, and ICP is a nested loop over them - without these caps one refine
   * runs for minutes. Both are strided samples of the downsampled cloud, so
   * they thin it evenly rather than cropping a region.
   */
  maxSourcePoints?: number;
  maxTargetPoints?: number;
  /** Convergence thresholds on one step, in scene units and radians. */
  translationEpsilon?: number;
  rotationEpsilon?: number;
  onProgress?: (progress: { scale: number; iteration: number; inlierRmse: number }) => void;
}

export interface IcpResult {
  /** Maps source into target, including the initial pose it started from. */
  matrix: THREE.Matrix4;
  iterations: number;
  inlierCount: number;
  /** RMS of the point-to-plane residual over the inliers, in scene units. */
  inlierRmse: number;
  /** Inliers as a fraction of the downsampled source — the overlap estimate. */
  fitness: number;
  /** True when the last scale stopped on the epsilons rather than on the cap. */
  converged: boolean;
}

/** Evenly thins a point array to at most `maxPoints`. */
function strideDown(points: Float32Array, maxPoints: number): Float32Array {
  const count = Math.floor(points.length / 3);
  if (count <= maxPoints) {
    return points;
  }
  const step = Math.ceil(count / maxPoints);
  const out = new Float32Array(Math.ceil(count / step) * 3);
  let write = 0;
  for (let i = 0; i < count; i += step) {
    out[write++] = points[i * 3];
    out[write++] = points[i * 3 + 1];
    out[write++] = points[i * 3 + 2];
  }
  return out.subarray(0, write);
}

/**
 * The finest cell `icpPointToPlane` would use for a pair, exposed so callers
 * comparing two runs can normalize their residuals by the same scale.
 */
export function defaultVoxelSize(source: Float32Array, target: Float32Array): number {
  // The smaller of the two: registration only has to describe the volume both
  // scans saw, and the larger cloud's reach says nothing about that.
  return Math.max(Math.min(robustExtent(source), robustExtent(target)) / 400, 1e-4);
}

/**
 * @param source Flat xyz triples in world space.
 * @param target Flat xyz triples in world space.
 * @returns null when either cloud is too small to register.
 */
export function icpPointToPlane(
  source: Float32Array,
  target: Float32Array,
  options: IcpOptions = {}
): IcpResult | null {
  if (source.length < 30 || target.length < 30) {
    return null;
  }

  const voxelSize = options.voxelSize ?? defaultVoxelSize(source, target);
  const scales = options.scales ?? [4, 2, 1];
  const gateFactor = options.gateFactor ?? 3;
  const trimRatio = Math.min(1, Math.max(0.1, options.trimRatio ?? 0.8));
  const maxIterations = options.maxIterationsPerScale ?? 30;
  const maxSourcePoints = options.maxSourcePoints ?? 60_000;
  const maxTargetPoints = options.maxTargetPoints ?? 200_000;
  const translationEpsilon = options.translationEpsilon ?? voxelSize * 0.01;
  const rotationEpsilon = options.rotationEpsilon ?? 1e-5;

  const current = options.initial ? options.initial.clone() : new THREE.Matrix4();
  let totalIterations = 0;
  let inlierCount = 0;
  let inlierRmse = 0;
  let fitness = 0;
  let converged = false;

  const scratch = new THREE.Vector3();

  for (const scale of scales) {
    const cell = voxelSize * scale;
    const gate = cell * gateFactor;
    const sourceDown = strideDown(voxelDownsample(source, cell), maxSourcePoints);
    const targetDown = strideDown(voxelDownsample(target, cell), maxTargetPoints);
    if (sourceDown.length < 30 || targetDown.length < 30) {
      continue;
    }

    const grid = new PointGrid(targetDown, gate);
    const normals = estimateNormals(grid, cell * 2.5);
    const sourceCount = sourceDown.length / 3;

    // Hoisted across iterations: the correspondence set is rebuilt every pass
    // and this is the hot loop's only allocation otherwise.
    const residuals = new Float64Array(sourceCount);
    const jacobian = new Float64Array(sourceCount * 6);
    const distances = new Float64Array(sourceCount);
    const order = new Int32Array(sourceCount);

    converged = false;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      totalIterations++;
      let matched = 0;

      for (let i = 0; i < sourceCount; i++) {
        scratch
          .set(sourceDown[i * 3], sourceDown[i * 3 + 1], sourceDown[i * 3 + 2])
          .applyMatrix4(current);
        const nearest = grid.nearest(scratch.x, scratch.y, scratch.z, gate);
        if (nearest < 0) {
          continue;
        }
        const nx = normals[nearest * 3];
        const ny = normals[nearest * 3 + 1];
        const nz = normals[nearest * 3 + 2];
        if (nx === 0 && ny === 0 && nz === 0) {
          continue;
        }

        const dx = scratch.x - targetDown[nearest * 3];
        const dy = scratch.y - targetDown[nearest * 3 + 1];
        const dz = scratch.z - targetDown[nearest * 3 + 2];

        const slot = matched++;
        residuals[slot] = dx * nx + dy * ny + dz * nz;
        distances[slot] = Math.hypot(dx, dy, dz);
        // [p x n, n]
        jacobian[slot * 6] = scratch.y * nz - scratch.z * ny;
        jacobian[slot * 6 + 1] = scratch.z * nx - scratch.x * nz;
        jacobian[slot * 6 + 2] = scratch.x * ny - scratch.y * nx;
        jacobian[slot * 6 + 3] = nx;
        jacobian[slot * 6 + 4] = ny;
        jacobian[slot * 6 + 5] = nz;
      }

      if (matched < 6) {
        break;
      }

      // Trimming: the far tail of the correspondence set is dominated by
      // surfaces only one of the two scans saw, and those pull the fit toward
      // geometry that has no counterpart at all.
      let kept = matched;
      let cutoff = Infinity;
      if (trimRatio < 1) {
        for (let i = 0; i < matched; i++) {
          order[i] = i;
        }
        const slice = order.subarray(0, matched);
        slice.sort((a, b) => distances[a] - distances[b]);
        kept = Math.max(6, Math.floor(matched * trimRatio));
        cutoff = distances[slice[kept - 1]];
      }

      const A = new Array<number>(36).fill(0);
      const b = new Array<number>(6).fill(0);
      let squaredSum = 0;
      let used = 0;
      for (let i = 0; i < matched; i++) {
        if (distances[i] > cutoff) {
          continue;
        }
        const r = residuals[i];
        squaredSum += r * r;
        used++;
        for (let row = 0; row < 6; row++) {
          const jr = jacobian[i * 6 + row];
          b[row] -= jr * r;
          for (let column = row; column < 6; column++) {
            A[row * 6 + column] += jr * jacobian[i * 6 + column];
          }
        }
      }
      for (let row = 0; row < 6; row++) {
        for (let column = 0; column < row; column++) {
          A[row * 6 + column] = A[column * 6 + row];
        }
        // Levenberg-style floor: keeps the system solvable when a scene is
        // degenerate for one degree of freedom (a single flat wall constrains
        // nothing along itself).
        A[row * 6 + row] += 1e-9;
      }

      const step = solveSymmetricPositiveDefinite(A, b, 6);
      if (!step) {
        break;
      }

      inlierCount = used;
      inlierRmse = Math.sqrt(squaredSum / Math.max(1, used));
      fitness = used / sourceCount;
      options.onProgress?.({ scale, iteration, inlierRmse });

      const omega = new THREE.Vector3(step[0], step[1], step[2]);
      const angle = omega.length();
      const delta = new THREE.Matrix4();
      if (angle > 1e-12) {
        delta.makeRotationAxis(omega.clone().normalize(), angle);
      }
      delta.setPosition(step[3], step[4], step[5]);
      current.premultiply(delta);

      if (angle < rotationEpsilon && Math.hypot(step[3], step[4], step[5]) < translationEpsilon) {
        converged = true;
        break;
      }
    }
  }

  if (inlierCount === 0) {
    return null;
  }

  return {
    matrix: current,
    iterations: totalIterations,
    inlierCount,
    inlierRmse,
    fitness,
    converged,
  };
}
