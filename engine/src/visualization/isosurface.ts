/**
 * Turns a loaded volume into the mesh the rest of the viewer already knows how
 * to handle.
 *
 * Keeping this separate from `marchingCubes.ts` draws the line between "extract
 * a surface at value X" (pure geometry, testable without any viewer concepts)
 * and "decide what X should be and hand the result to the scene".
 */

import type { SpatialData } from '../interfaces';
import type { VolumeData } from '../parsers/nrrdParser';
import { chooseStep, extractIsosurface, type IsosurfaceMesh } from './marchingCubes';

/**
 * Hounsfield units are an absolute scale — air is -1000, water 0, cortical
 * bone 300 and up — so a CT threshold can be a physically meaningful default
 * rather than a guess. This is the whole reason the bridge carries intensity
 * units alongside the voxels.
 */
export const BONE_HU = 300;

export interface IsosurfaceRequest {
  /** Omitted on first load, where `defaultThreshold` decides. */
  threshold?: number;
  step?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Picks the iso value to show before the user has touched anything.
 *
 * For CT this is a fixed, explicable number. For everything else — microscopy
 * channels, industrial CT in arbitrary units — there is no absolute scale, so
 * Otsu's method splits the histogram into background and foreground, which is
 * the standard answer and lands on something visible far more often than a
 * midpoint of the range does.
 */
export function defaultThreshold(volume: VolumeData): number {
  if (isHounsfield(volume)) {
    return BONE_HU;
  }
  return otsuThreshold(volume);
}

export function isHounsfield(volume: VolumeData): boolean {
  return (volume.intensityUnits || '').trim().toUpperCase() === 'HU';
}

/** Sample range, measured if the producer did not declare one. */
export function sampleRange(volume: VolumeData): { min: number; max: number } {
  if (volume.range) {
    return volume.range;
  }
  const samples = volume.samples;
  let min = Infinity;
  let max = -Infinity;
  // Stride over very large volumes: an exact range is not worth a full pass
  // when this only seeds a slider's bounds.
  const stride = samples.length > 40_000_000 ? 7 : 1;
  for (let i = 0; i < samples.length; i += stride) {
    const value = samples[i];
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { min: 0, max: 1 };
  }
  return { min, max };
}

export function otsuThreshold(volume: VolumeData, bins = 256): number {
  const { min, max } = sampleRange(volume);
  const samples = volume.samples;
  const histogram = new Float64Array(bins);
  const scale = (bins - 1) / (max - min);

  const stride = samples.length > 40_000_000 ? 7 : 1;
  let total = 0;
  for (let i = 0; i < samples.length; i += stride) {
    const bin = (samples[i] - min) * scale;
    histogram[bin < 0 ? 0 : bin > bins - 1 ? bins - 1 : bin | 0]++;
    total++;
  }

  let sum = 0;
  for (let i = 0; i < bins; i++) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  // A real volume's histogram has empty stretches between its modes, and every
  // bin in such a stretch scores identically. Taking the first maximum would
  // put the threshold hard against the lower mode — for a two-valued volume,
  // exactly on it, which then classifies everything as inside. Averaging over
  // the winning plateau puts it in the gap, where it belongs.
  let plateauStart = 0;
  let plateauEnd = 0;
  for (let i = 0; i < bins; i++) {
    weightBackground += histogram[i];
    if (weightBackground === 0) {
      continue;
    }
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) {
      break;
    }
    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      plateauStart = i;
      plateauEnd = i;
    } else if (variance === bestVariance) {
      plateauEnd = i;
    }
  }

  // Threshold at the upper edge of the chosen bin: bin `t` is background, so
  // the surface belongs just above it, not on it.
  return min + ((plateauStart + plateauEnd) / 2 + 0.5) / scale;
}

export interface VolumeMeshResult {
  data: SpatialData;
  mesh: IsosurfaceMesh;
  threshold: number;
}

/**
 * Extracts an isosurface and packages it as `SpatialData`.
 *
 * The mesh rides the typed-array path (`positionsArray` + `indicesArray`)
 * rather than the object-per-vertex `vertices`/`faces` shape: an isosurface of
 * a real CT is millions of triangles, and materialising an object per vertex
 * costs more memory than the entire source volume.
 */
export function buildVolumeMesh(
  volume: VolumeData,
  request: IsosurfaceRequest = {}
): VolumeMeshResult {
  const threshold = request.threshold ?? defaultThreshold(volume);
  const step = request.step ?? chooseStep(volume.sizes);

  const mesh = extractIsosurface(volume, {
    threshold,
    step,
    onProgress: request.onProgress,
  });

  const units = volume.spaceUnits;
  const comments = [
    `Volume ${volume.sizes.join(' x ')} voxels`,
    `Isosurface at ${formatThreshold(threshold, volume)}`,
    step > 1 ? `Decimated ${step}x per axis for extraction` : 'Full resolution',
    `World units: ${units}`,
  ];
  if (volume.channels > 1) {
    comments.push(`Source has ${volume.channels} channels; channel 0 was surfaced`);
  }

  const data: SpatialData = {
    vertices: [],
    faces: [],
    format: 'binary_little_endian',
    version: '1.0',
    comments,
    vertexCount: mesh.vertexCount,
    faceCount: mesh.triangleCount,
    hasColors: false,
    hasNormals: true,
    useTypedArrays: true,
    positionsArray: mesh.positions,
    normalsArray: mesh.normals,
    indicesArray: mesh.indices,
    colorsArray: null,
    fileName: volume.fileName,
    metadata: {
      volumeSizes: volume.sizes,
      ijkToWorld: volume.ijkToWorld,
      spaceUnits: units,
      intensityUnits: volume.intensityUnits,
      threshold,
      extractionStep: mesh.step,
      channels: volume.channels,
    },
  };

  return { data, mesh, threshold };
}

function formatThreshold(threshold: number, volume: VolumeData): string {
  const units = volume.intensityUnits;
  const rounded = Math.abs(threshold) >= 10 ? threshold.toFixed(0) : threshold.toFixed(3);
  return units ? `${rounded} ${units}` : rounded;
}
