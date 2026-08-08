/**
 * Scan-to-scan registration: align one loaded cloud onto another.
 *
 * Written for the case X3A archives create — several stations of the same site,
 * each expressed relative to its own capture position, with no pose anywhere in
 * the container to recover the relationship from (see the backlog item). It is
 * not specific to X3A though; the inputs are plain world-space coordinates, so
 * any two overlapping clouds work.
 *
 * Three stages, deliberately separable because they fail differently:
 *
 * - `fitRigidTransform` — manual correspondences. Always works, needs a human.
 * - `coarseAlign4Dof` — automatic, exploits that terrestrial scans are leveled.
 * - `icpPointToPlane` — refinement; needs a start already close to right.
 *
 * `registerClouds` runs coarse-then-ICP, which is the normal path.
 */

import * as THREE from 'three';
import { coarseAlign4Dof, type CoarseAlignOptions, type CoarseAlignResult } from './coarseAlign';
import { defaultVoxelSize, icpPointToPlane, type IcpOptions, type IcpResult } from './icp';

export { fitRigidTransform, type RigidFitResult } from './rigidFit';
export {
  coarseAlign4Dof,
  type CoarseAlignOptions,
  type CoarseAlignResult,
  type UpAxis,
} from './coarseAlign';
export { icpPointToPlane, defaultVoxelSize, type IcpOptions, type IcpResult } from './icp';
export { voxelDownsample, estimateNormals, PointGrid } from './pointIndex';

export interface RegisterCloudsOptions {
  /** Skip the coarse stage and refine from here (or from identity). */
  initial?: THREE.Matrix4;
  coarse?: CoarseAlignOptions | false;
  icp?: Omit<IcpOptions, 'initial'> | false;
  /**
   * How many of the coarse stage's yaw candidates to refine. Each costs one
   * full ICP run. 1 trusts the top peak; the default tries the shortlist.
   */
  maxCandidates?: number;
  /** Reports which candidate is being refined, for a progress display. */
  onCandidate?: (progress: { index: number; total: number; yawDegrees: number }) => void;
}

export interface RegisterCloudsResult {
  /** Maps source into target. */
  matrix: THREE.Matrix4;
  coarse: CoarseAlignResult | null;
  icp: IcpResult | null;
  /** Which coarse candidate won, or -1 when the coarse stage was skipped. */
  candidateIndex: number;
  /** How many candidates were refined before picking. */
  candidatesTried: number;
}

/**
 * Quality of a converged ICP result, for choosing between poses.
 *
 * Neither term works alone. Fitness alone prefers a loose pose that keeps every
 * point inside a wide gate; RMS alone prefers a pose that locked onto one small
 * patch and matched nothing else — that failure is exactly what a wrong yaw
 * looks like after refinement. Rewarding overlap while penalizing residual
 * relative to the cell size ranks the honest fit above both.
 */
function icpQuality(result: IcpResult, cell: number): number {
  return result.fitness / (1 + result.inlierRmse / Math.max(cell, 1e-6));
}

export function registerClouds(
  source: Float32Array,
  target: Float32Array,
  options: RegisterCloudsOptions = {}
): RegisterCloudsResult | null {
  let matrix = options.initial ? options.initial.clone() : new THREE.Matrix4();

  let coarse: CoarseAlignResult | null = null;
  if (options.coarse !== false) {
    coarse = coarseAlign4Dof(source, target, options.coarse ?? {});
    if (coarse) {
      matrix = coarse.matrix.clone();
    }
  }

  let icp: IcpResult | null = null;
  let candidateIndex = -1;
  let candidatesTried = 0;

  if (options.icp !== false) {
    const icpOptions = options.icp ?? {};
    // Refining every shortlisted yaw and keeping the best is what makes the
    // automatic path work on real scans, where the correct yaw often is not the
    // tallest correlation peak. Without a coarse stage there is one start.
    const starts = coarse
      ? coarse.candidates.slice(0, Math.max(1, options.maxCandidates ?? 5))
      : [{ matrix, yawDegrees: 0, score: 0 }];

    // One shared residual scale, so the candidates are ranked on equal terms.
    const cell = icpOptions.voxelSize ?? defaultVoxelSize(source, target);
    // Screening pass: coarse scales and a low iteration cap are enough to tell
    // a yaw that is converging from one that is wandering, and running the full
    // ladder on all five candidates costs minutes instead of seconds.
    const screening =
      starts.length > 1
        ? {
            ...icpOptions,
            scales: icpOptions.scales ?? [8, 4],
            maxIterationsPerScale: icpOptions.maxIterationsPerScale ?? 12,
            maxSourcePoints: Math.min(icpOptions.maxSourcePoints ?? 60_000, 20_000),
          }
        : icpOptions;

    let bestQuality = -Infinity;
    let bestStart: THREE.Matrix4 | null = null;
    for (let i = 0; i < starts.length; i++) {
      options.onCandidate?.({ index: i, total: starts.length, yawDegrees: starts[i].yawDegrees });
      const attempt = icpPointToPlane(source, target, {
        ...screening,
        initial: starts[i].matrix,
      });
      candidatesTried++;
      if (!attempt) {
        continue;
      }
      // Candidates arrive in coarse-score order, and a later one has to be
      // clearly better to displace an earlier one. Without that margin a
      // symmetric scene hands the win to whichever near-tie was measured last:
      // in a rectangular room the 180-degree flip fits every wall, and only the
      // correlation peak knows which way round the room actually is.
      const quality = icpQuality(attempt, cell);
      if (quality > bestQuality * (bestStart ? 1.05 : 1)) {
        bestQuality = quality;
        icp = attempt;
        bestStart = attempt.matrix;
        candidateIndex = coarse ? i : -1;
      }
    }

    // Full-resolution refinement, once, on whichever start survived screening.
    if (bestStart && starts.length > 1) {
      const refined = icpPointToPlane(source, target, { ...icpOptions, initial: bestStart });
      if (refined) {
        icp = refined;
      }
    }
    if (icp) {
      matrix = icp.matrix.clone();
    }
  }

  if (!coarse && !icp && !options.initial) {
    return null;
  }
  return { matrix, coarse, icp, candidateIndex, candidatesTried };
}
