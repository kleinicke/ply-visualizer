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
