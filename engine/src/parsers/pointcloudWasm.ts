/**
 * The engine's view of the Rust point-cloud parsers.
 *
 * `src/wasmPointcloud.ts` has fronted the same crate for a while, but only in
 * the extension host, so the standalone page and the webview ran the
 * TypeScript parsers instead and the two implementations drifted. This module
 * is the shared one: it loads the crate through the registration loader (which
 * already resolves the package in all four builds - extension host, webview,
 * standalone page and Node) and marshals results into the packed typed arrays
 * the format registry expects.
 *
 * Everything here runs on the calling thread. That is what the TypeScript
 * parsers did too, so it is not a regression, and the caveat from
 * `wasmLoader.browser.ts` applies: a webview Web Worker is not a separate
 * process, so moving the work off the UI thread means the extension host, not
 * a worker.
 */

import { loadRegistrationWasm } from '../registration/wasmLoader';

export interface WasmPointCloudResult {
  vertexCount: number;
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: Float32Array | null;
  intensityArray: Float32Array | null;
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity: boolean;
  /** [minX, minY, minZ, maxX, maxY, maxZ] */
  bbox: Float32Array;
  /** Raw JSON from the parser; empty for formats with no header facts. */
  metadataJson: string;
}

/* eslint-disable @typescript-eslint/naming-convention -- the names below are
   the wasm-bindgen surface; they are what the compiled module exports. */
interface RawResult {
  vertex_count: number;
  has_colors: boolean;
  has_normals: boolean;
  has_intensity: boolean;
  take_positions(): Float32Array;
  take_colors(): Uint8Array;
  take_normals(): Float32Array;
  take_intensity(): Float32Array;
  bbox(): Float32Array;
  /** Header facts the point buffers cannot carry; empty where there are none. */
  metadata_json: string;
  free?(): void;
}

/** `PlyResult` — richer than the point-only formats: faces and named scalars. */
interface RawPlyResult extends RawResult {
  face_count: number;
  is_gaussian_splat: boolean;
  scalar_field_names: string[];
  take_scalar_at(index: number): Float32Array;
  take_face_indices(): Uint32Array;
  take_face_sizes(): Uint32Array;
}

interface PointcloudWasm {
  parse_xyz(data: Uint8Array, variant: string, colorMode: string): RawResult;
  parse_pts(data: Uint8Array): RawResult;
  parse_pcd(data: Uint8Array): RawResult;
  parse_ply(data: Uint8Array): RawPlyResult;
  /** Parses a file already written into wasm memory - see `parsePlyFromResponse`. */
  parse_ply_at(ptr: number, len: number): RawPlyResult;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  /** Present only in the browser build, where the loader attaches it. */
  memory?: WebAssembly.Memory;
}

/** The PCD header, as the Rust parser reports it. */
export interface PcdHeaderInfo {
  format: 'ascii' | 'binary' | 'binary_compressed';
  width: number;
  height: number;
  fields: string[];
  size: number[];
  type: string[];
  count: number[];
  /** tx ty tz qw qx qy qz - the rigid transform the viewer applies on load. */
  viewpoint: number[];
  comments: string[];
}

/* eslint-enable @typescript-eslint/naming-convention */

export function marshalWasmPointCloud(r: RawResult): WasmPointCloudResult {
  const out: WasmPointCloudResult = {
    vertexCount: r.vertex_count,
    hasColors: r.has_colors,
    hasNormals: r.has_normals,
    hasIntensity: r.has_intensity,
    positionsArray: r.take_positions(),
    colorsArray: r.has_colors ? r.take_colors() : null,
    normalsArray: r.has_normals ? r.take_normals() : null,
    intensityArray: r.has_intensity ? r.take_intensity() : null,
    bbox: r.bbox(),
    metadataJson: r.metadata_json,
  };
  // The result owns wasm memory; the takes above have already copied it out.
  r.free?.();
  return out;
}

let loaded: Promise<PointcloudWasm | null> | null = null;

function loadPointcloudWasm(): Promise<PointcloudWasm | null> {
  if (!loaded) {
    loaded = loadRegistrationWasm().then(wasm => {
      const candidate = wasm as unknown as PointcloudWasm | null;
      return candidate && typeof candidate.parse_xyz === 'function' ? candidate : null;
    });
  }
  return loaded;
}

/**
 * Decide whether a coloured XYZ file writes colours as ints (`4`) or floats
 * (`0.0156`) by scanning the head of the file. XYZ carries no type information,
 * so this is one decision per file - writers are consistent - and only the
 * colour columns (index >= 3) are inspected, since positions always have
 * decimals. Mirrors `detectXyzColorMode` in `src/wasmPointcloud.ts`; the two
 * exist separately only because that one takes a Node `Buffer`.
 */
export function detectXyzColorMode(data: Uint8Array, variant: string): string {
  if (variant !== 'xyzrgb') {
    return 'auto';
  }
  const sample = data.subarray(0, Math.min(data.length, 64 * 1024));
  let text = '';
  for (let i = 0; i < sample.length; i++) {
    text += String.fromCharCode(sample[i]);
  }
  const lines = text.split('\n');
  // Drop the last (possibly truncated) line of the sample.
  const limit = sample.length < data.length ? lines.length - 1 : lines.length;
  for (let li = 0; li < limit; li++) {
    const t = lines[li].trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const toks = t.split(/\s+/);
    if (toks.length < 6) {
      continue;
    }
    for (let i = 3; i < toks.length; i++) {
      const tok = toks[i];
      if (tok.includes('.') || tok.includes('e') || tok.includes('E')) {
        return 'unit';
      }
    }
  }
  return 'byte';
}

/** Parse plain XYZ, XYZN or XYZRGB. Throws if the crate is unavailable. */
export async function parseXyzWasm(
  data: Uint8Array,
  variant: string
): Promise<WasmPointCloudResult> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  return marshalWasmPointCloud(wasm.parse_xyz(data, variant, detectXyzColorMode(data, variant)));
}

/** Parse a PTS point cloud. Throws if the crate is unavailable. */
export async function parsePtsWasm(data: Uint8Array): Promise<WasmPointCloudResult> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  return marshalWasmPointCloud(wasm.parse_pts(data));
}

/** A PLY as the viewer consumes it: typed arrays plus the header's own facts. */
export interface PlyParseResult {
  vertexCount: number;
  faceCount: number;
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: Float32Array | null;
  intensityArray: Float32Array | null;
  scalarFields: Record<string, Float32Array>;
  faces: { indices: number[] }[];
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity: boolean;
  isGaussianSplat: boolean;
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  version: string;
  comments: string[];
}

/**
 * Parse a PLY - either encoding, points or mesh, ordinary or 3D Gaussian
 * splat. Throws if the crate is unavailable or the file is malformed; there is
 * no second parser to fall back to.
 */
export async function parsePlyWasm(data: Uint8Array): Promise<PlyParseResult> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  return marshalPly(wasm.parse_ply(data));
}

/**
 * Parse a PLY straight from a fetch response, without the file ever existing as
 * a JavaScript buffer.
 *
 * `parsePlyWasm` takes a `Uint8Array`, which means wasm-bindgen copies the
 * whole file into wasm memory before parsing - on a 200 MB point cloud that
 * copy, plus the `ArrayBuffer` the fetch allocated to hold the bytes in the
 * first place, cost more than the parse itself. Here the response body is
 * streamed directly into a buffer inside wasm memory and parsed where it lies.
 *
 * Falls back to the copying path when the response has no length to size the
 * buffer with, or no readable stream.
 */
export async function parsePlyFromResponse(response: Response): Promise<PlyParseResult> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  const declared = Number(response.headers.get('content-length'));
  if (!wasm.memory || !response.body || !Number.isFinite(declared) || declared <= 0) {
    return marshalPly(wasm.parse_ply(new Uint8Array(await response.arrayBuffer())));
  }

  const ptr = wasm.alloc(declared);
  try {
    const reader = response.body.getReader();
    let written = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (written + value.byteLength > declared) {
        throw new Error(`PLY body is longer than its content-length (${declared})`);
      }
      // The view is rebuilt per chunk: any wasm allocation can grow the memory
      // and detach every view over the old buffer.
      new Uint8Array(wasm.memory.buffer, ptr, declared).set(value, written);
      written += value.byteLength;
    }
    if (written !== declared) {
      throw new Error(`PLY body ended early: ${written} of ${declared} bytes`);
    }
    return marshalPly(wasm.parse_ply_at(ptr, declared));
  } finally {
    wasm.dealloc(ptr, declared);
  }
}

function marshalPly(raw: RawPlyResult): PlyParseResult {
  const header = JSON.parse(raw.metadata_json) as {
    format: PlyParseResult['format'];
    version: string;
    comments: string[];
  };
  const scalarFields: Record<string, Float32Array> = {};
  const names = raw.scalar_field_names;
  const intensity = raw.has_intensity ? raw.take_intensity() : null;
  if (intensity) {
    scalarFields.intensity = intensity;
  }
  names.forEach((name, index) => {
    scalarFields[name] = raw.take_scalar_at(index);
  });

  // Faces come back flattened - a run of indices per face - because a PLY face
  // list is not fixed-width. The viewer wants one object per face.
  const faceIndices = raw.take_face_indices();
  const faceSizes = raw.take_face_sizes();
  const faces: { indices: number[] }[] = new Array(faceSizes.length);
  let cursor = 0;
  for (let i = 0; i < faceSizes.length; i++) {
    const size = faceSizes[i];
    const indices = new Array<number>(size);
    for (let j = 0; j < size; j++) {
      indices[j] = faceIndices[cursor + j];
    }
    faces[i] = { indices };
    cursor += size;
  }

  const result: PlyParseResult = {
    vertexCount: raw.vertex_count,
    faceCount: raw.face_count,
    positionsArray: raw.take_positions(),
    colorsArray: raw.has_colors ? raw.take_colors() : null,
    normalsArray: raw.has_normals ? raw.take_normals() : null,
    intensityArray: intensity,
    scalarFields,
    faces,
    hasColors: raw.has_colors,
    hasNormals: raw.has_normals,
    hasIntensity: raw.has_intensity,
    isGaussianSplat: raw.is_gaussian_splat,
    format: header.format,
    version: header.version,
    comments: header.comments,
  };
  raw.free?.();
  return result;
}

/**
 * Parse a PCD point cloud in any of its three encodings (ascii, binary,
 * binary_compressed). Throws if the crate is unavailable or the file is
 * malformed - there is no second parser to fall back to.
 */
export async function parsePcdWasm(
  data: Uint8Array
): Promise<WasmPointCloudResult & { header: PcdHeaderInfo }> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  const result = marshalWasmPointCloud(wasm.parse_pcd(data));
  return { ...result, header: JSON.parse(result.metadataJson) as PcdHeaderInfo };
}

/**
 * The parsed-file payload both hosts hand on - the webview through
 * `convertToUnifiedFormat`, the extension host through `postMessage`. Shared so
 * the two cannot describe the same parse differently, which they could while
 * each built this object beside its own JS parser.
 */
export function toPointCloudPayload(
  result: WasmPointCloudResult,
  format: string,
  comments: string[] = []
): Record<string, unknown> {
  return {
    vertexCount: result.vertexCount,
    positionsArray: result.positionsArray,
    colorsArray: result.colorsArray,
    normalsArray: result.normalsArray,
    intensityArray: result.intensityArray,
    hasColors: result.hasColors,
    hasNormals: result.hasNormals,
    hasIntensity: result.hasIntensity,
    scalarFields: result.intensityArray ? { intensity: result.intensityArray } : {},
    detectedFormat: describeLayout(result),
    comments,
    format,
    useTypedArrays: true,
  };
}

/**
 * The `pcdData` payload, which carries the header on top of the points: the
 * viewer applies VIEWPOINT as the file's initial transform, and the file list
 * shows the field names.
 */
export function toPcdPayload(
  result: WasmPointCloudResult & { header: PcdHeaderInfo }
): Record<string, unknown> {
  const { header } = result;
  return {
    ...toPointCloudPayload(result, header.format, header.comments),
    width: header.width,
    height: header.height,
    fields: header.fields,
    size: header.size,
    type: header.type,
    count: header.count,
    viewpoint: header.viewpoint,
  };
}

/** Human-readable column layout, for the status line and the PTS payload. */
export function describeLayout(result: WasmPointCloudResult): string {
  return (
    'x y z' +
    (result.hasIntensity ? ' intensity' : '') +
    (result.hasColors ? ' r g b' : '') +
    (result.hasNormals ? ' nx ny nz' : '')
  );
}
