import type { SpatialData } from '../interfaces';
import type { VolumeData } from '../parsers/nrrdParser';
import type { VolumeBrightnessRequest } from './volumePresentation';
import { buildVolumeVoxelsWasm } from './volumeWasm';

export interface VolumeVoxelsRequest extends VolumeBrightnessRequest {
  threshold: number;
  step?: readonly [number, number, number];
  /** Upper bound on emitted quads; the stride grows until the build fits. */
  maxFaces?: number;
  /**
   * Inclusive visible index range per axis. Unlike the other modes, voxel
   * clipping has to happen here rather than with clipping planes: only the
   * shell of the retained block is built, so a plane cutting through it would
   * expose a hollow interior. Rebuilding caps the cut with real voxel faces.
   */
  clip?: readonly (readonly [number, number])[];
  windowCenter?: number;
  windowWidth?: number;
  onProgress?: (fraction: number) => void;
}

export interface VolumeVoxelsResult {
  data: SpatialData;
  step: [number, number, number];
  /** World-space edge lengths of one emitted box, along i/j/k. */
  voxelSize: [number, number, number];
}

const DEFAULT_MAX_FACES = 1_000_000;

/**
 * Symmetric per-axis tint baked into the vertex colours. The scene's single
 * directional light would leave whole sides of the block near-black, which is
 * unusable for greyscale medical data, so voxels render unlit like the slice
 * mode and get this fixed shading instead. Opposite faces share a factor, so
 * the mapping from sample value to displayed grey stays the same whichever way
 * the camera looks at a face.
 */
/**
 * Emits one solid box per retained voxel. Each box spans exactly the sampled
 * cell in ijk space, so neighbouring voxels touch without gaps or overlap in
 * every direction — including between slices, whose spacing is usually much
 * larger than the in-plane pixel pitch. Faces shared with another retained
 * voxel are dropped, so only the outer shell is built.
 *
 * The meshing itself is Rust (`wasm/pointcloud-parser/src/volume/voxels.rs`),
 * including the stride growth that keeps the build inside its face budget.
 * What is left here is the request shape and the `SpatialData` the viewer
 * consumes.
 */
export async function buildVolumeVoxelsAsync(
  volume: VolumeData,
  request: VolumeVoxelsRequest,
  isCancelled: () => boolean
): Promise<VolumeVoxelsResult | null> {
  const base = request.step ?? [1, 1, 1];
  const maxFaces =
    request.maxFaces === undefined ? DEFAULT_MAX_FACES : Math.max(1, request.maxFaces);
  const clip = resolveClip(volume, request.clip);
  if (isCancelled()) {
    return null;
  }

  const mode = request.brightnessMode ?? 'dicom-window';
  const sliceRanges =
    mode === 'slice-auto' && request.sliceRanges
      ? Float64Array.from(
          request.sliceRanges.flatMap(range =>
            range ? [range.min, range.max] : [Number.NaN, Number.NaN]
          )
        )
      : new Float64Array(0);
  const volumeRange =
    mode === 'volume-range' && request.volumeRange
      ? Float64Array.from([request.volumeRange.min, request.volumeRange.max])
      : new Float64Array(0);
  const photometric = (volume.header['photometric interpretation'] ?? '').trim().toUpperCase();

  const mesh = await buildVolumeVoxelsWasm(
    volume.samples,
    volume.sizes,
    volume.ijkToWorld,
    request.threshold,
    base as [number, number, number],
    maxFaces,
    [clip[0][0], clip[0][1], clip[1][0], clip[1][1], clip[2][0], clip[2][1]],
    {
      // The Rust kernel names the whole-volume mode 'volume-auto'; the panel
      // calls it 'volume-range'. One rename at the boundary rather than two
      // vocabularies inside the kernel.
      mode: mode === 'volume-range' ? 'volume-auto' : mode,
      windowCenter: request.windowCenter ?? 0,
      windowWidth: request.windowWidth ?? 1,
      sliceRanges,
      volumeRange,
      monochrome1: photometric === 'MONOCHROME1',
    }
  );
  request.onProgress?.(1);
  if (isCancelled()) {
    return null;
  }

  const step = mesh.step;
  const voxelSize = mesh.voxelSize;
  const faces = mesh.faceCount;
  const vertexCount = mesh.vertexCount;
  const positions = mesh.positions;
  const colors = mesh.colors;
  const intensity = mesh.intensity;
  const indices = mesh.indices;

  return {
    step,
    voxelSize,
    data: {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [
        `Volume ${volume.sizes.join(' x ')} voxels`,
        `One solid box per voxel at or above ${request.threshold}`,
        `Box size ${voxelSize.join(' x ')} ${volume.spaceUnits || ''}`.trim(),
      ],
      vertexCount,
      faceCount: faces * 2,
      hasColors: true,
      hasNormals: false,
      hasIntensity: true,
      useTypedArrays: true,
      positionsArray: positions,
      colorsArray: colors,
      indicesArray: indices,
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
        brightnessMode: request.brightnessMode,
        photometricInterpretation: photometric,
        extractionStep: step,
        effectiveSpacing: voxelSize,
        voxelSize,
        voxelClip: clip.map(range => [...range]),
        renderedVoxelCount: mesh.voxelCount,
        renderedFaceCount: faces,
        sourceVoxelCount: volume.sizes[0] * volume.sizes[1] * volume.sizes[2],
        volumeRenderMode: 'voxels',
        channels: volume.channels,
      },
    },
  };
}

type Clip = ReadonlyArray<readonly [number, number]>;

function resolveClip(volume: VolumeData, requested: Clip | undefined): Clip {
  return volume.sizes.map((size, axis) => {
    const max = Math.max(0, size - 1);
    const range = requested?.[axis];
    if (!range) {
      return [0, max] as const;
    }
    const lower = Math.max(0, Math.min(max, Math.round(Math.min(range[0], range[1]))));
    const upper = Math.max(0, Math.min(max, Math.round(Math.max(range[0], range[1]))));
    return [lower, upper] as const;
  });
}

/** First sample index on the global stride grid that the clip range keeps. */
function clipStart(clip: Clip, axis: number, stride: number): number {
  return Math.ceil(clip[axis][0] / stride) * stride;
}
