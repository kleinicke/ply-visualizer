/**
 * Marching cubes over a scalar volume.
 *
 * This is the cheapest useful thing the volume bridge can do: the heavy pass
 * turns an intensity stack into an ordinary indexed triangle mesh, which is
 * already this viewer's core competence — so the result flows through the
 * existing geometry, transform, measurement and comparison paths without a
 * volume renderer existing yet.
 *
 * Output is in the volume's declared world space (metres for DICOM loaded by
 * this extension), not in voxel indices, because a mesh whose coordinates are
 * array subscripts cannot be measured against anything else in the scene.
 */

import type { VolumeData } from '../parsers/nrrdParser';
import { extractIsosurfaceWasm } from './volumeWasm';

export interface IsosurfaceOptions {
  /** Iso value, in whatever units the volume's samples carry. */
  threshold: number;
  /** Sample stride in i, j and k. A scalar is accepted for compatibility. */
  step?: readonly [number, number, number] | number;
  /**
   * Refuse to build a mesh larger than this many triangles, rather than
   * exhausting memory. The caller is expected to have chosen `step` so this
   * is not hit; it is a backstop for pathological thresholds (an iso value
   * inside the noise floor makes almost every cell active).
   */
  maxTriangles?: number;
  onProgress?: (fraction: number) => void;
}

export interface IsosurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  /** Grid step actually used, so callers can report what they rendered. */
  step: [number, number, number];
  /** World-space gradient magnitude at every vertex. */
  gradientMagnitudes: Float32Array;
}

export function chooseStep(
  sizes: readonly number[],
  ijkToWorld: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  cellBudget = 40_000_000
): [number, number, number] {
  const voxelSizes = [
    Math.hypot(ijkToWorld[0], ijkToWorld[4], ijkToWorld[8]),
    Math.hypot(ijkToWorld[1], ijkToWorld[5], ijkToWorld[9]),
    Math.hypot(ijkToWorld[2], ijkToWorld[6], ijkToWorld[10]),
  ].map(value => (Number.isFinite(value) && value > 0 ? value : 1));
  const targetWorldSpacing = Math.max(...voxelSizes);
  const base = voxelSizes.map((size, axis) =>
    Math.max(1, Math.min(sizes[axis] - 1, Math.round(targetWorldSpacing / size)))
  ) as [number, number, number];

  let scale = 1;
  let step: [number, number, number] = [...base];
  while (
    Math.floor((sizes[0] - 1) / step[0]) *
      Math.floor((sizes[1] - 1) / step[1]) *
      Math.floor((sizes[2] - 1) / step[2]) >
    cellBudget
  ) {
    scale++;
    step = base.map((value, axis) => Math.max(1, Math.min(sizes[axis] - 1, value * scale))) as [
      number,
      number,
      number,
    ];
  }
  return step;
}

/** A Float32Array that grows by doubling, to avoid per-vertex array-of-number boxing. */

/**
 * Refuse to build a mesh larger than this, rather than exhausting memory. The
 * caller is expected to have chosen `step` so it is not hit; it is a backstop
 * for pathological thresholds, where an iso value inside the noise floor makes
 * almost every cell active.
 */
const DEFAULT_MAX_TRIANGLES = 12_000_000;

/**
 * Extract an isosurface at `options.threshold`.
 *
 * The extraction is Rust (`wasm/pointcloud-parser/src/volume/`); what remains
 * here is the decimation choice above and this call. The JavaScript that used
 * to do it was a generator yielding per k-layer so a single-threaded page could
 * stay responsive - the extraction runs in the extension host, which is its own
 * process, so there was nothing to yield to and one call is simpler.
 */
export async function extractIsosurface(
  volume: VolumeData,
  options: IsosurfaceOptions
): Promise<IsosurfaceMesh> {
  const requestedStep = options.step ?? [1, 1, 1];
  const step = (
    typeof requestedStep === 'number'
      ? [requestedStep, requestedStep, requestedStep]
      : requestedStep
  ).map(value => Math.max(1, Math.floor(value))) as [number, number, number];

  const mesh = await extractIsosurfaceWasm(
    volume.samples,
    volume.sizes,
    volume.ijkToWorld,
    options.threshold,
    step,
    options.maxTriangles ?? DEFAULT_MAX_TRIANGLES
  );
  options.onProgress?.(1);

  return {
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
    step: mesh.step,
    gradientMagnitudes: mesh.gradientMagnitudes,
  };
}

/**
 * Cooperative variant used by interactive re-extraction.
 *
 * The cancellation check now brackets one call rather than interleaving with
 * the work: the kernel runs to completion, and a request that was cancelled
 * while it ran is discarded instead of being displayed.
 */
export async function extractIsosurfaceAsync(
  volume: VolumeData,
  options: IsosurfaceOptions,
  isCancelled: () => boolean
): Promise<IsosurfaceMesh | null> {
  if (isCancelled()) {
    return null;
  }
  const mesh = await extractIsosurface(volume, options);
  return isCancelled() ? null : mesh;
}
