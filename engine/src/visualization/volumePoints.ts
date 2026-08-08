import type { SpatialData } from '../interfaces';
import type { VolumeData } from '../parsers/nrrdParser';
import { volumeGreyByte } from './volumePresentation';

export interface VolumePointsRequest {
  threshold: number;
  step?: readonly [number, number, number];
  maxPoints?: number;
  windowCenter?: number;
  windowWidth?: number;
  onProgress?: (fraction: number) => void;
}

export interface VolumePointsResult {
  data: SpatialData;
  step: [number, number, number];
}

/** Emits one ordinary world-space point for every voxel at/above the threshold. */
export function buildVolumePoints(
  volume: VolumeData,
  request: VolumePointsRequest
): VolumePointsResult {
  const base = request.step ?? [1, 1, 1];
  const maxPoints =
    request.maxPoints === undefined ? Number.POSITIVE_INFINITY : Math.max(1, request.maxPoints);
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
  const colors = new Uint8Array(count * 3);
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  const m = volume.ijkToWorld;
  let point = 0;
  for (let k = 0; k < nz; k += sz) {
    for (let j = 0; j < ny; j += sy) {
      for (let i = 0; i < nx; i += sx) {
        const value = volume.samples[i + j * nx + k * nx * ny];
        if (value < request.threshold) {
          continue;
        }
        const p = point * 3;
        positions[p] = m[0] * i + m[1] * j + m[2] * k + m[3];
        positions[p + 1] = m[4] * i + m[5] * j + m[6] * k + m[7];
        positions[p + 2] = m[8] * i + m[9] * j + m[10] * k + m[11];
        const grey = volumeGreyByte(
          value,
          request.windowCenter ?? 0,
          request.windowWidth ?? 1,
          volume.header['photometric interpretation']
        );
        colors[p] = grey;
        colors[p + 1] = grey;
        colors[p + 2] = grey;
        intensity[point++] = value;
      }
    }
    request.onProgress?.(Math.min(1, (k + sz) / nz));
  }

  return packageVolumePoints(volume, request, step, positions, intensity, colors);
}

/** Cooperative point extraction so a newer threshold request can supersede it. */
export async function buildVolumePointsAsync(
  volume: VolumeData,
  request: VolumePointsRequest,
  isCancelled: () => boolean
): Promise<VolumePointsResult | null> {
  const base = request.step ?? [1, 1, 1];
  const maxPoints =
    request.maxPoints === undefined ? Number.POSITIVE_INFINITY : Math.max(1, request.maxPoints);
  let multiplier = 1;
  let count: number | null = 0;
  let step: [number, number, number] = [...base];
  do {
    step = base.map(value => Math.max(1, value * multiplier)) as [number, number, number];
    count = await countPointsAsync(volume, request.threshold, step, maxPoints + 1, isCancelled);
    if (count === null) {
      return null;
    }
    multiplier++;
  } while (count > maxPoints);

  const positions = new Float32Array(count * 3);
  const intensity = new Float32Array(count);
  const colors = new Uint8Array(count * 3);
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  const m = volume.ijkToWorld;
  let point = 0;
  for (let k = 0; k < nz; k += sz) {
    for (let j = 0; j < ny; j += sy) {
      for (let i = 0; i < nx; i += sx) {
        const value = volume.samples[i + j * nx + k * nx * ny];
        if (value < request.threshold) {
          continue;
        }
        const p = point * 3;
        positions[p] = m[0] * i + m[1] * j + m[2] * k + m[3];
        positions[p + 1] = m[4] * i + m[5] * j + m[6] * k + m[7];
        positions[p + 2] = m[8] * i + m[9] * j + m[10] * k + m[11];
        const grey = volumeGreyByte(
          value,
          request.windowCenter ?? 0,
          request.windowWidth ?? 1,
          volume.header['photometric interpretation']
        );
        colors[p] = grey;
        colors[p + 1] = grey;
        colors[p + 2] = grey;
        intensity[point++] = value;
      }
    }
    request.onProgress?.(Math.min(1, (k + sz) / nz));
    if (isCancelled()) {
      return null;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return packageVolumePoints(volume, request, step, positions, intensity, colors);
}

function packageVolumePoints(
  volume: VolumeData,
  request: VolumePointsRequest,
  step: [number, number, number],
  positions: Float32Array,
  intensity: Float32Array,
  colors: Uint8Array
): VolumePointsResult {
  const count = intensity.length;
  const m = volume.ijkToWorld;
  const effectiveSpacing: [number, number, number] = [
    Math.hypot(m[0], m[4], m[8]) * step[0],
    Math.hypot(m[1], m[5], m[9]) * step[1],
    Math.hypot(m[2], m[6], m[10]) * step[2],
  ];
  return {
    step,
    data: {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [
        `Volume ${volume.sizes.join(' x ')} voxels`,
        `One point per voxel at or above ${request.threshold}`,
        `Extraction stride ${step.join(' x ')} voxels (i/j/k)`,
      ],
      vertexCount: count,
      faceCount: 0,
      hasColors: true,
      hasNormals: false,
      hasIntensity: true,
      useTypedArrays: true,
      positionsArray: positions,
      colorsArray: colors,
      intensityArray: intensity,
      scalarFields: { intensity },
      fileName: volume.fileName,
      metadata: {
        volumeSizes: volume.sizes,
        ijkToWorld: volume.ijkToWorld,
        spaceUnits: volume.spaceUnits,
        intensityUnits: volume.intensityUnits,
        threshold: request.threshold,
        windowCenter: request.windowCenter,
        windowWidth: request.windowWidth,
        photometricInterpretation: volume.header['photometric interpretation'],
        extractionStep: step,
        effectiveSpacing,
        renderedPointCount: count,
        sourceVoxelCount: volume.sizes[0] * volume.sizes[1] * volume.sizes[2],
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
    if (isCancelled()) {
      return null;
    }
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
