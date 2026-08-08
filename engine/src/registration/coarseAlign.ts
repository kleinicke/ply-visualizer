/**
 * 4-DoF coarse alignment for terrestrial scans: yaw sweep + FFT phase
 * correlation for the horizontal shift, 1-D correlation for the vertical one.
 *
 * The whole reason automatic alignment is affordable here is that the search is
 * not 6-DoF. A tripod scanner levels itself with a dual-axis compensator, so
 * two stations of the same site differ by a yaw and a translation, and roll and
 * pitch are already correct to within a fraction of a degree. That collapses
 * global registration from "match 3-D features and RANSAC a pose" to "try every
 * yaw and let the FFT hand you the best translation for each" — no descriptors,
 * no correspondences, no random sampling, and a deterministic answer.
 *
 * The output is a coarse pose. It is meant to be handed straight to `icp`.
 */

import * as THREE from 'three';
import { fft2d } from './fft';

export type UpAxis = 'x' | 'y' | 'z';

/** What each top-down raster cell measures; see `rasterize`. */
export type RasterFeature = 'verticality' | 'density';

export interface CoarseAlignOptions {
  /** Vertical axis of the scene. Terrestrial scans are leveled about it. */
  upAxis?: UpAxis;
  /** Raster resolution per side; must be a power of two. */
  resolution?: number;
  /** Yaw step of the initial full-circle sweep, in degrees. */
  yawStepDegrees?: number;
  /** Limits rasterization cost on huge clouds by striding the input. */
  maxSamples?: number;
  /** Raster cell value. `verticality` by default; see `rasterize`. */
  feature?: RasterFeature;
  /** How many separated yaw peaks to report in `candidates`. */
  candidateCount?: number;
}

export interface CoarseAlignCandidate {
  /** Maps source into target; rotation is pure yaw about the up axis. */
  matrix: THREE.Matrix4;
  yawDegrees: number;
  /**
   * Normalized phase-correlation peak. Not a distance — a confidence, and only
   * meaningful next to the other candidates: what matters is how far the winner
   * stands above the runner-up, not its absolute height.
   */
  score: number;
}

export interface CoarseAlignResult extends CoarseAlignCandidate {
  /** Peak height of the runner-up yaw, for judging how unambiguous the win is. */
  runnerUpScore: number;
  /**
   * The best separated yaw peaks, strongest first, `candidates[0]` being this
   * result itself.
   *
   * Reported because on real scans the sweep is often close to ambiguous - two
   * stations looking at one building corner from different sides share little
   * enough that the correct yaw wins by a few percent, or loses. Handing the
   * shortlist to ICP and keeping whichever actually converges is far more
   * reliable than trusting the top peak, and that is what `registerClouds`
   * does.
   */
  candidates: CoarseAlignCandidate[];
}

const CYCLIC_AXES: Record<UpAxis, [number, number, number]> = {
  // (up, first horizontal, second horizontal), cyclic so that a positive angle
  // in the horizontal plane matches a right-handed rotation about the up axis.
  x: [0, 1, 2],
  y: [1, 2, 0],
  z: [2, 0, 1],
};

function sampleStride(pointCount: number, maxSamples: number): number {
  return Math.max(1, Math.ceil(pointCount / maxSamples));
}

/**
 * Accumulates points into an `n x n` top-down raster, log-compressed and
 * mean-removed.
 *
 * Two features are available and they behave very differently on real scans:
 *
 * - `verticality` (the default) stores each cell's vertical extent, so a wall,
 *   a pole or a building edge lights up and flat ground contributes nothing.
 *   That matters because ground is most of what a terrestrial scan sees and it
 *   is identical everywhere, so a density raster of an outdoor site correlates
 *   almost as well at the wrong yaw as at the right one. Measured on a real
 *   two-station archive, this is the difference between a peak that barely
 *   clears its runner-up and one that clearly wins.
 * - `density` stores the point count, log-compressed. The log matters: raw
 *   counts are dominated by the ring of extreme density right around the
 *   tripod, which carries no information about where the station stood.
 *
 * Removing the mean afterwards keeps the DC term from planting a spurious peak
 * at zero shift.
 */
function rasterize(
  points: Float32Array,
  axes: [number, number, number],
  angle: number,
  center: [number, number, number],
  originA: number,
  originB: number,
  cell: number,
  n: number,
  stride: number,
  feature: RasterFeature
): Float64Array {
  const [upIndex, axisA, axisB] = axes;
  const grid = new Float64Array(n * n);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const count = Math.floor(points.length / 3);

  const minUp = feature === 'verticality' ? new Float64Array(n * n).fill(Infinity) : null;
  const maxUp = feature === 'verticality' ? new Float64Array(n * n).fill(-Infinity) : null;

  for (let i = 0; i < count; i += stride) {
    const a = points[i * 3 + axisA] - center[axisA];
    const b = points[i * 3 + axisB] - center[axisB];
    const rotatedA = cos * a - sin * b + center[axisA];
    const rotatedB = sin * a + cos * b + center[axisB];
    const ia = Math.floor((rotatedA - originA) / cell);
    const ib = Math.floor((rotatedB - originB) / cell);
    if (ia < 0 || ia >= n || ib < 0 || ib >= n) {
      continue;
    }
    const index = ib * n + ia;
    if (minUp && maxUp) {
      const up = points[i * 3 + upIndex];
      if (up < minUp[index]) {minUp[index] = up;}
      if (up > maxUp[index]) {maxUp[index] = up;}
    } else {
      grid[index] += 1;
    }
  }

  let sum = 0;
  for (let i = 0; i < grid.length; i++) {
    if (minUp && maxUp) {
      grid[i] = maxUp[i] > minUp[i] ? Math.log1p(maxUp[i] - minUp[i]) : 0;
    } else {
      grid[i] = Math.log1p(grid[i]);
    }
    sum += grid[i];
  }
  const mean = sum / grid.length;
  for (let i = 0; i < grid.length; i++) {
    grid[i] -= mean;
  }
  return grid;
}

/**
 * Phase correlation of `source` against a pre-transformed target spectrum.
 * Returns the integer cell shift that best maps source onto target, and the
 * peak height.
 */
function correlate(
  source: Float64Array,
  targetRe: Float64Array,
  targetIm: Float64Array,
  n: number
): { shiftA: number; shiftB: number; peak: number } {
  const re = Float64Array.from(source);
  const im = new Float64Array(n * n);
  fft2d(re, im, n, false);

  // Cross-power spectrum with magnitude normalization: keeping only the phase
  // is what makes the peak sharp and the result insensitive to one scan simply
  // having more points than the other.
  for (let i = 0; i < re.length; i++) {
    const cr = re[i] * targetRe[i] + im[i] * targetIm[i];
    const ci = re[i] * targetIm[i] - im[i] * targetRe[i];
    const magnitude = Math.hypot(cr, ci);
    if (magnitude > 1e-12) {
      re[i] = cr / magnitude;
      im[i] = ci / magnitude;
    } else {
      re[i] = 0;
      im[i] = 0;
    }
  }
  fft2d(re, im, n, true);

  let peak = -Infinity;
  let peakIndex = 0;
  for (let i = 0; i < re.length; i++) {
    if (re[i] > peak) {
      peak = re[i];
      peakIndex = i;
    }
  }

  const rawA = peakIndex % n;
  const rawB = Math.floor(peakIndex / n);
  return {
    // A correlation peak past the halfway point is a negative shift wrapped
    // around by the transform's periodicity.
    shiftA: rawA > n / 2 ? rawA - n : rawA,
    shiftB: rawB > n / 2 ? rawB - n : rawB,
    peak,
  };
}

/**
 * Robust centre and working extent of a cloud, seen from above.
 *
 * Both are percentile-based rather than the mean and the bounding box, and on
 * real scans that is the difference between working and not. A station scan is
 * a dense core a few metres across with a thin tail of long-range returns
 * reaching a hundred metres: measured on one archive, half the points sit
 * inside 4.4 m while the bounding box spans 150 m. Sizing the raster from that
 * box puts every overlapping structure into two or three cells and leaves the
 * correlation nothing to lock onto, and the mean centre is dragged off by the
 * tail. The 90th-percentile radius describes the part of the scan that another
 * station can actually have seen too.
 */
function horizontalCentroidAndSpan(
  points: Float32Array,
  axes: [number, number, number],
  stride: number
): { centroid: [number, number, number]; span: number } {
  const count = Math.floor(points.length / 3);
  const [, axisA, axisB] = axes;
  const samplesA: number[] = [];
  const samplesB: number[] = [];
  const samplesUp: number[] = [];
  const [upIndex] = axes;
  for (let i = 0; i < count; i += stride) {
    samplesA.push(points[i * 3 + axisA]);
    samplesB.push(points[i * 3 + axisB]);
    samplesUp.push(points[i * 3 + upIndex]);
  }
  if (samplesA.length === 0) {
    return { centroid: [0, 0, 0], span: 1 };
  }

  const median = (values: number[]) => {
    const sorted = values.slice().sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const centreA = median(samplesA);
  const centreB = median(samplesB);

  const radii = samplesA.map((value, i) => Math.hypot(value - centreA, samplesB[i] - centreB));
  radii.sort((x, y) => x - y);
  const percentile90 = radii[Math.floor(radii.length * 0.9)];

  const centroid: [number, number, number] = [0, 0, 0];
  centroid[axisA] = centreA;
  centroid[axisB] = centreB;
  centroid[upIndex] = median(samplesUp);
  return { centroid, span: Math.max(percentile90 * 2, 1e-3) };
}

/** Best vertical offset from a direct correlation of the two height histograms. */
function estimateVerticalShift(
  source: Float32Array,
  target: Float32Array,
  upAxisIndex: number,
  binSize: number,
  stride: number
): number {
  const gather = (points: Float32Array) => {
    const values: number[] = [];
    const count = Math.floor(points.length / 3);
    for (let i = 0; i < count; i += stride) {
      values.push(points[i * 3 + upAxisIndex]);
    }
    return values;
  };
  const sourceValues = gather(source);
  const targetValues = gather(target);
  if (sourceValues.length === 0 || targetValues.length === 0) {
    return 0;
  }

  // Explicit loop, not Math.min(...values): these arrays hold tens of thousands
  // of samples and spreading them overflows the call stack.
  let min = Infinity;
  let max = -Infinity;
  for (const values of [sourceValues, targetValues]) {
    for (const value of values) {
      if (value < min) {min = value;}
      if (value > max) {max = value;}
    }
  }
  const bins = Math.min(2048, Math.max(8, Math.ceil((max - min) / binSize) + 1));
  const width = (max - min) / bins || 1;

  const histogram = (values: number[]) => {
    const out = new Float64Array(bins);
    for (const value of values) {
      out[Math.min(bins - 1, Math.max(0, Math.floor((value - min) / width)))] += 1;
    }
    let sum = 0;
    for (let i = 0; i < bins; i++) {
      out[i] = Math.log1p(out[i]);
      sum += out[i];
    }
    const mean = sum / bins;
    for (let i = 0; i < bins; i++) {
      out[i] -= mean;
    }
    return out;
  };

  const sourceHistogram = histogram(sourceValues);
  const targetHistogram = histogram(targetValues);

  const maxLag = Math.floor(bins / 2);
  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let i = 0; i < bins; i++) {
      const j = i + lag;
      if (j >= 0 && j < bins) {
        score += sourceHistogram[i] * targetHistogram[j];
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return bestLag * width;
}

/**
 * @param source Flat xyz triples, already in world space.
 * @param target Flat xyz triples, already in world space.
 */
export function coarseAlign4Dof(
  source: Float32Array,
  target: Float32Array,
  options: CoarseAlignOptions = {}
): CoarseAlignResult | null {
  const upAxis = options.upAxis ?? 'z';
  const n = options.resolution ?? 128;
  const yawStep = options.yawStepDegrees ?? 5;
  const maxSamples = options.maxSamples ?? 200_000;
  const feature = options.feature ?? 'verticality';
  const candidateCount = Math.max(1, options.candidateCount ?? 5);

  if ((n & (n - 1)) !== 0 || n < 16) {
    throw new Error(`coarseAlign4Dof: resolution must be a power of two >= 16, got ${n}`);
  }
  if (source.length < 9 || target.length < 9) {
    return null;
  }

  const axes = CYCLIC_AXES[upAxis];
  const [upIndex, axisA, axisB] = axes;
  const sourceStride = sampleStride(source.length / 3, maxSamples);
  const targetStride = sampleStride(target.length / 3, maxSamples);

  const sourceInfo = horizontalCentroidAndSpan(source, axes, sourceStride);
  const targetInfo = horizontalCentroidAndSpan(target, axes, targetStride);

  // The window is half again as wide as the larger cloud, so a shift of up to
  // three quarters of a cloud's extent stays inside the transform's unambiguous
  // range instead of aliasing around it.
  const window = Math.max(sourceInfo.span, targetInfo.span) * 1.5;
  const cell = window / n;
  const originA = targetInfo.centroid[axisA] - window / 2;
  const originB = targetInfo.centroid[axisB] - window / 2;

  // The source is pre-centred on the target so the sweep only has to explain
  // the residual offset, which keeps the search inside the window above.
  const preShift: [number, number, number] = [0, 0, 0];
  preShift[axisA] = targetInfo.centroid[axisA] - sourceInfo.centroid[axisA];
  preShift[axisB] = targetInfo.centroid[axisB] - sourceInfo.centroid[axisB];
  const rotationCenter: [number, number, number] = [...sourceInfo.centroid];
  rotationCenter[axisA] += preShift[axisA];
  rotationCenter[axisB] += preShift[axisB];

  const shiftedSource = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 3) {
    shiftedSource[i] = source[i] + preShift[0];
    shiftedSource[i + 1] = source[i + 1] + preShift[1];
    shiftedSource[i + 2] = source[i + 2] + preShift[2];
  }

  const targetGrid = rasterize(
    target,
    axes,
    0,
    targetInfo.centroid,
    originA,
    originB,
    cell,
    n,
    targetStride,
    feature
  );
  const targetRe = Float64Array.from(targetGrid);
  const targetIm = new Float64Array(n * n);
  fft2d(targetRe, targetIm, n, false);

  const evaluate = (yawDegrees: number) => {
    const angle = (yawDegrees * Math.PI) / 180;
    const grid = rasterize(
      shiftedSource,
      axes,
      angle,
      rotationCenter,
      originA,
      originB,
      cell,
      n,
      sourceStride,
      feature
    );
    return { yawDegrees, ...correlate(grid, targetRe, targetIm, n) };
  };

  const upVector = new THREE.Vector3(
    upIndex === 0 ? 1 : 0,
    upIndex === 1 ? 1 : 0,
    upIndex === 2 ? 1 : 0
  );
  const center = new THREE.Vector3(rotationCenter[0], rotationCenter[1], rotationCenter[2]);

  const buildPose = (hypothesis: ReturnType<typeof evaluate>): CoarseAlignCandidate => {
    const angle = (hypothesis.yawDegrees * Math.PI) / 180;
    // `correlate` returns the shift that has to be *added* to the source to
    // land on the target, in cells; see the conjugation order there.
    const residual: [number, number, number] = [0, 0, 0];
    residual[axisA] = hypothesis.shiftA * cell;
    residual[axisB] = hypothesis.shiftB * cell;

    // p -> p + preShift -> yaw about the shifted centre -> + residual.
    const matrix = new THREE.Matrix4().makeTranslation(preShift[0], preShift[1], preShift[2]);
    matrix.premultiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
    matrix.premultiply(new THREE.Matrix4().makeRotationAxis(upVector, angle));
    matrix.premultiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));
    matrix.premultiply(new THREE.Matrix4().makeTranslation(residual[0], residual[1], residual[2]));

    // Vertical offset is estimated on the horizontally aligned clouds, so the
    // histograms describe the same structures.
    const aligned = new Float32Array(source.length);
    const scratch = new THREE.Vector3();
    for (let i = 0; i < source.length; i += 3) {
      scratch.set(source[i], source[i + 1], source[i + 2]).applyMatrix4(matrix);
      aligned[i] = scratch.x;
      aligned[i + 1] = scratch.y;
      aligned[i + 2] = scratch.z;
    }
    const verticalShift = estimateVerticalShift(aligned, target, upIndex, cell, sourceStride);
    const upShift = new THREE.Vector3().copy(upVector).multiplyScalar(verticalShift);
    matrix.premultiply(new THREE.Matrix4().makeTranslation(upShift.x, upShift.y, upShift.z));

    return {
      matrix,
      yawDegrees: ((hypothesis.yawDegrees % 360) + 360) % 360,
      score: hypothesis.peak,
    };
  };

  const sweep = [];
  for (let yaw = 0; yaw < 360; yaw += yawStep) {
    sweep.push(evaluate(yaw));
  }
  sweep.sort((x, y) => y.peak - x.peak);

  const angularDistance = (x: number, y: number) => {
    const difference = Math.abs(((x - y) % 360) + 360) % 360;
    return Math.min(difference, 360 - difference);
  };

  // Several yaws either side of one peak are the same hypothesis; keep only
  // separated ones, so the candidate list holds genuinely different guesses.
  const distinct: typeof sweep = [];
  for (const hypothesis of sweep) {
    if (distinct.every(kept => angularDistance(kept.yawDegrees, hypothesis.yawDegrees) > yawStep)) {
      distinct.push(hypothesis);
    }
    if (distinct.length >= candidateCount) {
      break;
    }
  }

  // Refine each survivor to 1 degree. Cheap next to the full sweep, and it
  // hands ICP starts that are already inside its convergence basin.
  const refined = distinct.map(hypothesis => {
    let best = hypothesis;
    for (let offset = -yawStep + 1; offset < yawStep; offset++) {
      if (offset === 0) {
        continue;
      }
      const candidate = evaluate(hypothesis.yawDegrees + offset);
      if (candidate.peak > best.peak) {
        best = candidate;
      }
    }
    return best;
  });
  refined.sort((x, y) => y.peak - x.peak);

  const candidates = refined.map(buildPose);
  return {
    ...candidates[0],
    runnerUpScore: refined[1]?.peak ?? 0,
    candidates,
  };
}
