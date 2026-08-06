import type { SpatialData } from '../interfaces';
import type { VolumeData } from '../parsers/nrrdParser';
import { chooseStep } from './marchingCubes';

export interface VolumePointsRequest {
  threshold: number;
  step?: readonly [number, number, number];
  maxPoints?: number;
  onProgress?: (fraction: number) => void;
}

export interface VolumePointsResult {
  data: SpatialData;
  step: [number, number, number];
}

const DEFAULT_MAX_POINTS = 2_000_000;

/** Emits thresholded voxels as ordinary world-space points with intensity. */
export function buildVolumePoints(
  volume: VolumeData,
  request: VolumePointsRequest
): VolumePointsResult {
  const base = request.step ?? chooseStep(volume.sizes, volume.ijkToWorld);
  const maxPoints = Math.max(1, request.maxPoints ?? DEFAULT_MAX_POINTS);
  let multiplier = 1;
  let count = 0;
  let step: [number, number, number] = [...base];

  // Count first so a low threshold cannot allocate an unbounded point buffer.
  do {
    step = base.map(value => Math.max(1, value * multiplier)) as [number, number, number];
    count = countPoints(volume, request.threshold, step, maxPoints + 1);
    multiplier++;
  } while (count > maxPoints);

  const positions = new Float32Array(count * 3);
  const intensity = new Float32Array(count);
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  const m = volume.ijkToWorld;
  let point = 0;
  for (let k = 0; k < nz; k += sz) {
    for (let j = 0; j < ny; j += sy) {
      for (let i = 0; i < nx; i += sx) {
        const value = volume.samples[i + j * nx + k * nx * ny];
        if (value < request.threshold) {continue;}
        const p = point * 3;
        positions[p] = m[0] * i + m[1] * j + m[2] * k + m[3];
        positions[p + 1] = m[4] * i + m[5] * j + m[6] * k + m[7];
        positions[p + 2] = m[8] * i + m[9] * j + m[10] * k + m[11];
        intensity[point++] = value;
      }
    }
    request.onProgress?.(Math.min(1, (k + sz) / nz));
  }

  return packageVolumePoints(volume, request.threshold, step, positions, intensity);
}

/** Cooperative point extraction so a newer threshold request can supersede it. */
export async function buildVolumePointsAsync(
  volume: VolumeData,
  request: VolumePointsRequest,
  isCancelled: () => boolean
): Promise<VolumePointsResult | null> {
  const base = request.step ?? chooseStep(volume.sizes, volume.ijkToWorld);
  const maxPoints = Math.max(1, request.maxPoints ?? DEFAULT_MAX_POINTS);
  let multiplier = 1;
  let count: number | null = 0;
  let step: [number, number, number] = [...base];
  do {
    step = base.map(value => Math.max(1, value * multiplier)) as [number, number, number];
    count = await countPointsAsync(volume, request.threshold, step, maxPoints + 1, isCancelled);
    if (count === null) {return null;}
    multiplier++;
  } while (count > maxPoints);

  const positions = new Float32Array(count * 3);
  const intensity = new Float32Array(count);
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  const m = volume.ijkToWorld;
  let point = 0;
  for (let k = 0; k < nz; k += sz) {
    for (let j = 0; j < ny; j += sy) {
      for (let i = 0; i < nx; i += sx) {
        const value = volume.samples[i + j * nx + k * nx * ny];
        if (value < request.threshold) {continue;}
        const p = point * 3;
        positions[p] = m[0] * i + m[1] * j + m[2] * k + m[3];
        positions[p + 1] = m[4] * i + m[5] * j + m[6] * k + m[7];
        positions[p + 2] = m[8] * i + m[9] * j + m[10] * k + m[11];
        intensity[point++] = value;
      }
    }
    request.onProgress?.(Math.min(1, (k + sz) / nz));
    if (isCancelled()) {return null;}
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return packageVolumePoints(volume, request.threshold, step, positions, intensity);
}

function packageVolumePoints(
  volume: VolumeData,
  threshold: number,
  step: [number, number, number],
  positions: Float32Array,
  intensity: Float32Array
): VolumePointsResult {
  const count = intensity.length;
  return {
    step,
    data: {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [
        `Volume ${volume.sizes.join(' x ')} voxels`,
        `Points at or above ${threshold}`,
        `Extraction stride ${step.join(' x ')} voxels (i/j/k)`,
      ],
      vertexCount: count,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      hasIntensity: true,
      useTypedArrays: true,
      positionsArray: positions,
      intensityArray: intensity,
      scalarFields: { intensity },
      colorsArray: null,
      fileName: volume.fileName,
      metadata: {
        volumeSizes: volume.sizes,
        ijkToWorld: volume.ijkToWorld,
        spaceUnits: volume.spaceUnits,
        intensityUnits: volume.intensityUnits,
        threshold,
        extractionStep: step,
        volumeRenderMode: 'points',
        channels: volume.channels,
      },
    },
  };
}

async function countPointsAsync(
  volume: VolumeData,
  threshold: number,
  step: readonly [number, number, number],
  stopAfter: number,
  isCancelled: () => boolean
): Promise<number | null> {
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  let count = 0;
  for (let k = 0; k < nz; k += sz) {
    for (let j = 0; j < ny; j += sy) {
      for (let i = 0; i < nx; i += sx) {
        if (volume.samples[i + j * nx + k * nx * ny] >= threshold && ++count >= stopAfter) {
          return count;
        }
      }
    }
    if (isCancelled()) {return null;}
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return count;
}

function countPoints(
  volume: VolumeData,
  threshold: number,
  step: readonly [number, number, number],
  stopAfter: number
): number {
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  let count = 0;
  for (let k = 0; k < nz; k += sz) {
    for (let j = 0; j < ny; j += sy) {
      for (let i = 0; i < nx; i += sx) {
        if (volume.samples[i + j * nx + k * nx * ny] >= threshold && ++count >= stopAfter) {
          return count;
        }
      }
    }
  }
  return count;
}
