/**
 * The Rust marching-cubes kernel, as the viewer calls it.
 *
 * Loaded through the registration loader, which already resolves the package in
 * all four builds - extension host, webview, standalone page and Node. The
 * extraction itself is `wasm/pointcloud-parser/src/volume/`.
 */

import { loadRegistrationWasm } from '../registration/wasmLoader';

/* eslint-disable @typescript-eslint/naming-convention -- the wasm-bindgen surface. */
interface RawIsosurfaceMesh {
  vertex_count: number;
  triangle_count: number;
  step: Uint32Array;
  take_positions(): Float32Array;
  take_normals(): Float32Array;
  take_indices(): Uint32Array;
  take_gradient_magnitudes(): Float32Array;
  free?(): void;
}

interface VolumeWasm {
  extract_isosurface(
    samples: Float32Array,
    sizes: Uint32Array,
    ijkToWorld: Float64Array,
    threshold: number,
    step: Uint32Array,
    maxTriangles: number
  ): RawIsosurfaceMesh;
}
/* eslint-enable @typescript-eslint/naming-convention */

let loaded: Promise<VolumeWasm | null> | null = null;

function loadVolumeWasm(): Promise<VolumeWasm | null> {
  if (!loaded) {
    loaded = loadRegistrationWasm().then(wasm => {
      const candidate = wasm as unknown as VolumeWasm | null;
      return candidate && typeof candidate.extract_isosurface === 'function' ? candidate : null;
    });
  }
  return loaded;
}

export interface WasmIsosurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  gradientMagnitudes: Float32Array;
  vertexCount: number;
  triangleCount: number;
  step: [number, number, number];
}

/**
 * Extract an isosurface. Throws when the crate is unavailable or the volume is
 * too small for the requested decimation - there is no JavaScript marching
 * cubes to fall back to.
 */
export async function extractIsosurfaceWasm(
  samples: ArrayLike<number>,
  sizes: readonly number[],
  ijkToWorld: readonly number[],
  threshold: number,
  step: readonly [number, number, number],
  maxTriangles: number
): Promise<WasmIsosurfaceMesh> {
  const wasm = await loadVolumeWasm();
  if (!wasm) {
    throw new Error('Isosurface extraction requires the Rust/WASM kernel');
  }
  // Volumes arrive in whatever type the file carried (16-bit CT, 8-bit
  // microscopy); the kernel works in f32, so anything else is converted once
  // here rather than branching per sample inside the loop.
  const values = samples instanceof Float32Array ? samples : Float32Array.from(samples);

  const raw = wasm.extract_isosurface(
    values,
    Uint32Array.from(sizes),
    Float64Array.from(ijkToWorld),
    threshold,
    Uint32Array.from(step),
    maxTriangles
  );
  const used = Array.from(raw.step) as [number, number, number];
  const mesh: WasmIsosurfaceMesh = {
    vertexCount: raw.vertex_count,
    triangleCount: raw.triangle_count,
    positions: raw.take_positions(),
    normals: raw.take_normals(),
    indices: raw.take_indices(),
    gradientMagnitudes: raw.take_gradient_magnitudes(),
    step: used,
  };
  raw.free?.();
  return mesh;
}

/* eslint-disable @typescript-eslint/naming-convention -- the wasm-bindgen surface. */
interface RawNrrdVolume {
  sizes: Uint32Array;
  ijk_to_world: Float64Array;
  channels: number;
  metadata_json: string;
  take_samples(): Float32Array;
  free?(): void;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface WasmNrrdVolume {
  sizes: [number, number, number];
  samples: Float32Array;
  ijkToWorld: number[];
  channels: number;
  header: Record<string, string>;
}

/**
 * Read a NRRD volume. `detached` carries the payload when the header names a
 * separate data file; pass an empty array otherwise.
 */
export async function parseNrrdWasm(
  data: Uint8Array,
  detached: Uint8Array = new Uint8Array(0)
): Promise<WasmNrrdVolume> {
  const wasm = (await loadVolumeWasm()) as
    | (VolumeWasm & {
        parse_nrrd(data: Uint8Array, detached: Uint8Array): RawNrrdVolume;
      })
    | null;
  if (!wasm || typeof wasm.parse_nrrd !== 'function') {
    throw new Error('Reading NRRD requires the Rust/WASM kernel');
  }
  const raw = wasm.parse_nrrd(data, detached);
  const volume: WasmNrrdVolume = {
    sizes: Array.from(raw.sizes) as [number, number, number],
    ijkToWorld: Array.from(raw.ijk_to_world),
    channels: raw.channels,
    header: JSON.parse(raw.metadata_json) as Record<string, string>,
    samples: raw.take_samples(),
  };
  raw.free?.();
  return volume;
}

/* eslint-disable @typescript-eslint/naming-convention -- the wasm-bindgen surface. */
interface RawVoxelMesh {
  vertex_count: number;
  face_count: number;
  voxel_count: number;
  step: Uint32Array;
  voxel_size: Float32Array;
  take_positions(): Float32Array;
  take_colors(): Uint8Array;
  take_intensity(): Float32Array;
  take_indices(): Uint32Array;
  free?(): void;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface WasmVoxelMesh {
  positions: Float32Array;
  colors: Uint8Array;
  intensity: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  faceCount: number;
  /** Voxels kept, whether or not they showed a face. */
  voxelCount: number;
  step: [number, number, number];
  voxelSize: [number, number, number];
}

export interface VoxelBrightness {
  mode: string;
  windowCenter: number;
  windowWidth: number;
  /** Two entries per slice for `slice-auto`; empty otherwise. */
  sliceRanges: Float64Array;
  /** Two entries for `volume-auto`; empty otherwise. */
  volumeRange: Float64Array;
  monochrome1: boolean;
}

/** Build the exposed shell of every retained voxel. */
export async function buildVolumeVoxelsWasm(
  samples: ArrayLike<number>,
  sizes: readonly number[],
  ijkToWorld: readonly number[],
  threshold: number,
  step: readonly [number, number, number],
  maxFaces: number,
  clip: readonly number[],
  brightness: VoxelBrightness
): Promise<WasmVoxelMesh> {
  const wasm = (await loadVolumeWasm()) as
    | (VolumeWasm & {
        build_volume_voxels(
          samples: Float32Array,
          sizes: Uint32Array,
          ijkToWorld: Float64Array,
          threshold: number,
          step: Uint32Array,
          maxFaces: number,
          clip: Uint32Array,
          brightnessMode: string,
          windowCenter: number,
          windowWidth: number,
          sliceRanges: Float64Array,
          volumeRange: Float64Array,
          monochrome1: boolean
        ): RawVoxelMesh;
      })
    | null;
  if (!wasm || typeof wasm.build_volume_voxels !== 'function') {
    throw new Error('Building voxels requires the Rust/WASM kernel');
  }
  const values = samples instanceof Float32Array ? samples : Float32Array.from(samples);
  const raw = wasm.build_volume_voxels(
    values,
    Uint32Array.from(sizes),
    Float64Array.from(ijkToWorld),
    threshold,
    Uint32Array.from(step),
    maxFaces,
    Uint32Array.from(clip),
    brightness.mode,
    brightness.windowCenter,
    brightness.windowWidth,
    brightness.sliceRanges,
    brightness.volumeRange,
    brightness.monochrome1
  );
  const mesh: WasmVoxelMesh = {
    vertexCount: raw.vertex_count,
    faceCount: raw.face_count,
    voxelCount: raw.voxel_count,
    step: Array.from(raw.step) as [number, number, number],
    voxelSize: Array.from(raw.voxel_size) as [number, number, number],
    positions: raw.take_positions(),
    colors: raw.take_colors(),
    intensity: raw.take_intensity(),
    indices: raw.take_indices(),
  };
  raw.free?.();
  return mesh;
}
