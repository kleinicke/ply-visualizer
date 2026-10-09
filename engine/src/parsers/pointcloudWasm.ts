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
  scalarFields?: Record<string, Float32Array>;
  sourcePointIndices?: Uint32Array;
  sourcePointCount?: number;
  /** The row map is the identity; `sourcePointIndices` is then absent. */
  sourceRowsIdentity?: boolean;
}

/* eslint-disable @typescript-eslint/naming-convention -- the names below are
   the wasm-bindgen surface; they are what the compiled module exports. */
interface RawResult {
  source_count?: number;
  source_rows_identity?: boolean;
  take_source_indices?(): Uint32Array;
  scalar_field_names?: string[];
  take_scalar_at?(index: number): Float32Array;
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

/** `MeshResult` - STL and OFF. */
interface RawMeshResult {
  vertex_count: number;
  triangle_count: number;
  has_normals: boolean;
  has_colors: boolean;
  metadata_json: string;
  take_positions(): Float32Array;
  take_normals(): Float32Array;
  take_colors(): Uint8Array;
  take_indices(): Uint32Array;
  free?(): void;
}

/** `ObjResult`. */
interface RawObjResult {
  vertex_count: number;
  normal_count: number;
  texcoord_count: number;
  face_count: number;
  material_names: string[];
  material_file: string;
  current_material: string;
  take_positions(): Float32Array;
  take_normals(): Float32Array;
  take_indices(): Uint32Array;
  take_face_sizes(): Uint32Array;
  take_face_materials(): Uint32Array;
  take_line_indices(): Uint32Array;
  take_line_materials(): Uint32Array;
  take_point_indices(): Uint32Array;
  take_point_materials(): Uint32Array;
  free?(): void;
}

interface RawNpyResult {
  name: string;
  shape: Uint32Array;
  dtype: string;
  take_values(): Float32Array;
  free?(): void;
}

/** `PlyVertexStream` in ply.rs: a binary point cloud decoded as it arrives. */
interface RawPlyStream {
  readonly data_start: number;
  readonly vertex_count: number;
  readonly stride: number;
  readonly chunk_records: number;
  readonly has_colors: boolean;
  readonly has_normals: boolean;
  readonly has_intensity: boolean;
  readonly is_gaussian_splat: boolean;
  readonly metadata_json: string;
  readonly scalar_field_names: string[];
  readonly decoded: number;
  readonly first_non_finite: number;
  input_ptr(): number;
  decode(records: number): number;
  positions_ptr(): number;
  colors_ptr(): number;
  normals_ptr(): number;
  intensity_ptr(): number;
  scalar_ptr(index: number): number;
  free?(): void;
}

interface PointcloudWasm {
  parse_text_table(data: Uint8Array, options: string): RawResult;
  parse_xyz(data: Uint8Array, variant: string, colorMode: string): RawResult;
  parse_pts(data: Uint8Array): RawResult;
  parse_pcd(data: Uint8Array): RawResult;
  parse_ply(data: Uint8Array): RawPlyResult;
  /** Parses a file already written into wasm memory - see `parsePlyFromResponse`. */
  parse_ply_at(ptr: number, len: number): RawPlyResult;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  PlyVertexStream?: { open(head: Uint8Array): RawPlyStream | undefined };
  parse_stl(data: Uint8Array): RawMeshResult;
  parse_off(data: Uint8Array): RawMeshResult;
  parse_obj(data: Uint8Array): RawObjResult;
  npy_inspect(data: Uint8Array): string;
  npy_read(data: Uint8Array, name: string): RawNpyResult;
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
  const sourceIndices = r.take_source_indices?.();
  const out: WasmPointCloudResult = {
    sourcePointCount: r.source_count || undefined,
    // Readers without source-row tracking return an empty vector, not a map.
    sourcePointIndices: sourceIndices?.length ? sourceIndices : undefined,
    sourceRowsIdentity: r.source_rows_identity || undefined,
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
    scalarFields: Object.fromEntries(
      (r.scalar_field_names ?? []).map((name, i) => [name, r.take_scalar_at!(i)])
    ),
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
  /** Faces as triangles (polygons fan-triangulated); null for point clouds. */
  indicesArray: Uint32Array | null;
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
 * Run the PLY parser once on a small synthetic file, so V8 has optimised it
 * before the real one arrives.
 *
 * A fresh page runs wasm in its baseline tier and recompiles hot functions in
 * the background, but a call already running stays on the baseline code - and
 * a whole-file parse is one call. Every opened file gets a fresh webview, so
 * every binary PLY was parsed at baseline speed: 315 ms against 110 ms once
 * optimised, for eight million vertices. A 50k-vertex parse (about 10 ms)
 * while the real bytes are still in flight is enough to trigger the
 * recompilation. The layout carries every attribute the fast vertex loop
 * reads, plus faces, so all of it is exercised.
 */
export async function warmUpPlyParser(): Promise<void> {
  const vertices = 50_000;
  const faces = 2_000;
  const header =
    'ply\nformat binary_little_endian 1.0\n' +
    `element vertex ${vertices}\n` +
    'property float x\nproperty float y\nproperty float z\n' +
    'property float nx\nproperty float ny\nproperty float nz\n' +
    'property uchar red\nproperty uchar green\nproperty uchar blue\n' +
    'property float intensity\n' +
    `element face ${faces}\nproperty list uchar int vertex_indices\nend_header\n`;
  const head = new TextEncoder().encode(header);
  const recordBytes = 31;
  const faceBytes = 13;
  const bytes = new Uint8Array(head.length + vertices * recordBytes + faces * faceBytes);
  bytes.set(head);
  const view = new DataView(bytes.buffer);
  let at = head.length + vertices * recordBytes;
  for (let face = 0; face < faces; face++, at += faceBytes) {
    view.setUint8(at, 3);
    view.setInt32(at + 1, face, true);
    view.setInt32(at + 5, face + 1, true);
    view.setInt32(at + 9, face + 2, true);
  }
  await parsePlyWasm(bytes);
}

/**
 * Parse a PLY straight from a fetch response, without the file ever existing as
 * a JavaScript buffer.
 *
 * `parsePlyWasm` takes a `Uint8Array`, which means wasm-bindgen copies the
 * whole file into wasm memory before parsing - on a 200 MB point cloud that
 * copy, plus the `ArrayBuffer` the fetch allocated to hold the bytes in the
 * first place, cost more than the parse itself. Here the response body is
 * streamed straight into wasm memory: a binary point cloud is decoded chunk by
 * chunk while the rest is still arriving (`streamPlyVertices`); anything else
 * is written into one buffer there and parsed where it lies.
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
  return parsePlyFromReader(wasm, response.body.getReader(), declared);
}

async function parsePlyFromReader(
  wasm: PointcloudWasm,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  declared: number
): Promise<PlyParseResult> {
  // Read until the header is complete, then decide how to take the body.
  const head: Uint8Array[] = [];
  let headLength = 0;
  let headerEnd = -1;
  while (headerEnd < 0) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    head.push(value);
    headLength += value.byteLength;
    headerEnd = findHeaderEnd(head, headLength);
    if (headerEnd < 0 && headLength > 1 << 20) {
      break; // no header in the first megabyte: let the parser report it
    }
  }
  const prefix = concatChunks(head, headLength);
  const stream =
    headerEnd >= 0 ? wasm.PlyVertexStream?.open(prefix.subarray(0, headerEnd)) : undefined;
  if (stream) {
    try {
      return await streamPlyVertices(wasm, stream, prefix, reader);
    } finally {
      stream.free?.();
    }
  }
  return parsePlyInWasmMemory(wasm, prefix, reader, declared);
}

/**
 * Parse a PLY already held in memory (bytes posted by the extension host, as
 * for "+ Add Point Cloud"). A binary point cloud goes through the same chunked
 * decoder as a streamed fetch, so the file is never copied into wasm memory
 * whole next to its own decoded arrays; anything else is parsed in one call.
 */
export async function parsePlyBytes(bytes: Uint8Array): Promise<PlyParseResult> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  if (wasm.memory && wasm.PlyVertexStream) {
    const headerEnd = findHeaderEnd([bytes], bytes.byteLength);
    const stream =
      headerEnd >= 0 ? wasm.PlyVertexStream.open(bytes.subarray(0, headerEnd)) : undefined;
    if (stream) {
      const nothingMore = {
        read: async () => ({ done: true as const, value: undefined }),
        cancel: async () => undefined,
      } as unknown as ReadableStreamDefaultReader<Uint8Array>;
      try {
        return await streamPlyVertices(wasm, stream, bytes, nothingMore);
      } finally {
        stream.free?.();
      }
    }
  }
  return marshalPly(wasm.parse_ply(bytes));
}

/** Offset just past `end_header\n` in the chunks read so far, or -1. */
function findHeaderEnd(chunks: Uint8Array[], length: number): number {
  const bytes = concatChunks(chunks, Math.min(length, 1 << 20));
  const text = new TextDecoder('latin1').decode(bytes);
  const at = text.indexOf('end_header');
  if (at < 0) {
    return -1;
  }
  const newline = text.indexOf('\n', at);
  return newline < 0 ? -1 : newline + 1;
}

function concatChunks(chunks: Uint8Array[], length: number): Uint8Array {
  if (chunks.length === 1 && chunks[0].byteLength === length) {
    return chunks[0];
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    if (at >= length) {
      break;
    }
    const part = chunk.subarray(0, length - at);
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

/**
 * The whole file in wasm memory, parsed where it lies: meshes, ASCII and
 * anything else `PlyVertexStream` declines.
 */
async function parsePlyInWasmMemory(
  wasm: PointcloudWasm,
  prefix: Uint8Array,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  declared: number
): Promise<PlyParseResult> {
  const ptr = wasm.alloc(declared);
  try {
    let written = 0;
    const write = (value: Uint8Array) => {
      if (written + value.byteLength > declared) {
        throw new Error(`PLY body is longer than its content-length (${declared})`);
      }
      // The view is rebuilt per chunk: any wasm allocation can grow the memory
      // and detach every view over the old buffer.
      new Uint8Array(wasm.memory!.buffer, ptr, declared).set(value, written);
      written += value.byteLength;
    };
    write(prefix);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      write(value);
    }
    if (written !== declared) {
      throw new Error(`PLY body ended early: ${written} of ${declared} bytes`);
    }
    return marshalPly(wasm.parse_ply_at(ptr, declared));
  } finally {
    wasm.dealloc(ptr, declared);
  }
}

/**
 * A binary point cloud decoded while the rest of it is still arriving (see
 * `PlyVertexStream` in ply.rs for why). Records are gathered into the
 * stream's scratch buffer; each full buffer is decoded and its vertices
 * copied into the final arrays, which are the only full-size buffers there
 * ever are. Produces exactly what `marshalPly(parse_ply_at(...))` would.
 */
async function streamPlyVertices(
  wasm: PointcloudWasm,
  stream: RawPlyStream,
  prefix: Uint8Array,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<PlyParseResult> {
  const count = stream.vertex_count;
  const stride = stream.stride;
  const capacity = stream.chunk_records;
  const names = stream.scalar_field_names;
  const positions = new Float32Array(count * 3);
  const colors = stream.has_colors ? new Uint8Array(count * 3) : null;
  const normals = stream.has_normals ? new Float32Array(count * 3) : null;
  const intensity = stream.has_intensity ? new Float32Array(count) : null;
  const scalars = names.map(() => new Float32Array(count));

  // Bytes waiting in the scratch buffer (`filled`), always fewer than a full
  // buffer between calls.
  let filled = 0;
  let decoded = 0;
  const decode = (records: number) => {
    const n = stream.decode(records);
    // Views after the call: decoding the first chunk grows wasm memory.
    const memory = wasm.memory!.buffer;
    positions.set(new Float32Array(memory, stream.positions_ptr(), n * 3), decoded * 3);
    colors?.set(new Uint8Array(memory, stream.colors_ptr(), n * 3), decoded * 3);
    normals?.set(new Float32Array(memory, stream.normals_ptr(), n * 3), decoded * 3);
    intensity?.set(new Float32Array(memory, stream.intensity_ptr(), n), decoded);
    scalars.forEach((out, index) =>
      out.set(new Float32Array(memory, stream.scalar_ptr(index), n), decoded)
    );
    decoded += n;
    return n;
  };
  const take = (bytes: Uint8Array) => {
    let at = 0;
    while (at < bytes.byteLength && decoded < count) {
      const room = capacity * stride - filled;
      const part = bytes.subarray(at, at + room);
      // Pointer first: the first call allocates the buffer and can grow (and
      // so detach) wasm memory.
      const input = stream.input_ptr();
      new Uint8Array(wasm.memory!.buffer, input, capacity * stride).set(part, filled);
      filled += part.byteLength;
      at += part.byteLength;
      if (filled === capacity * stride) {
        decode(capacity);
        filled = 0;
      }
    }
  };

  take(prefix.subarray(stream.data_start));
  while (decoded < count) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    take(value);
  }
  if (decoded < count && filled >= stride) {
    decode(Math.floor(filled / stride));
  }
  // Whatever follows the vertices (an element the viewer ignores) is not
  // needed; stop the transfer rather than read it.
  void reader.cancel().catch(() => undefined);

  if (decoded !== count) {
    throw new Error(
      `PLY vertex data is truncated: header declares ${count} vertices, but only ${decoded} complete records are present`
    );
  }
  if (stream.first_non_finite > 0) {
    throw new Error(
      `PLY contains a non-finite x/y/z coordinate at vertex ${stream.first_non_finite}`
    );
  }

  const header = JSON.parse(stream.metadata_json) as {
    format: PlyParseResult['format'];
    version: string;
    comments: string[];
  };
  const scalarFields: Record<string, Float32Array> = {};
  if (intensity) {
    scalarFields.intensity = intensity;
  }
  names.forEach((name, index) => {
    scalarFields[name] = scalars[index];
  });
  return {
    vertexCount: count,
    faceCount: 0,
    positionsArray: positions,
    colorsArray: colors,
    normalsArray: normals,
    intensityArray: intensity,
    scalarFields,
    indicesArray: null,
    hasColors: stream.has_colors,
    hasNormals: stream.has_normals,
    hasIntensity: stream.has_intensity,
    isGaussianSplat: stream.is_gaussian_splat,
    format: header.format,
    version: header.version,
    comments: header.comments,
  };
}

/**
 * Fan-triangulate flattened polygons (`sizes[i]` indices per face, back to
 * back). Faces with fewer than three corners draw nothing and are dropped, as
 * the geometry builder always did. Null when there are no triangles.
 */
export function triangulateFaces(indices: Uint32Array, sizes: Uint32Array): Uint32Array | null {
  let triangles = 0;
  let allTriangles = true;
  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] !== 3) {
      allTriangles = false;
    }
    if (sizes[i] >= 3) {
      triangles += sizes[i] - 2;
    }
  }
  if (triangles === 0) {
    return null;
  }
  if (allTriangles) {
    return indices;
  }
  const out = new Uint32Array(triangles * 3);
  let read = 0;
  let write = 0;
  for (let face = 0; face < sizes.length; face++) {
    const size = sizes[face];
    for (let k = 1; k < size - 1; k++) {
      out[write++] = indices[read];
      out[write++] = indices[read + k];
      out[write++] = indices[read + k + 1];
    }
    read += size;
  }
  return out;
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
  // list is not fixed-width. The geometry wants triangles, which for the usual
  // all-triangle mesh is that buffer unchanged.
  const indicesArray = triangulateFaces(raw.take_face_indices(), raw.take_face_sizes());

  const result: PlyParseResult = {
    vertexCount: raw.vertex_count,
    faceCount: indicesArray ? indicesArray.length / 3 : 0,
    positionsArray: raw.take_positions(),
    colorsArray: raw.has_colors ? raw.take_colors() : null,
    normalsArray: raw.has_normals ? raw.take_normals() : null,
    intensityArray: intensity,
    scalarFields,
    indicesArray,
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
    sourcePointCount: result.sourcePointCount,
    sourcePointIndices: result.sourcePointIndices,
    sourceRowsIdentity: result.sourceRowsIdentity,
    vertexCount: result.vertexCount,
    positionsArray: result.positionsArray,
    colorsArray: result.colorsArray,
    normalsArray: result.normalsArray,
    intensityArray: result.intensityArray,
    hasColors: result.hasColors,
    hasNormals: result.hasNormals,
    hasIntensity: result.hasIntensity,
    scalarFields: {
      ...result.scalarFields,
      ...(result.intensityArray ? { intensity: result.intensityArray } : {}),
    },
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

/** One array inside a `.npy` file or `.npz` archive, before it is decoded. */
export interface NpyArrayInfo {
  /** Empty for a plain `.npy`; the archive key for a member of an `.npz`. */
  name: string;
  shape: number[];
  /** The NumPy descr string, e.g. `<f4`. */
  dtype: string;
}

/** A decoded array. Every dtype arrives as f32 - both callers want floats. */
export interface NpyArray extends NpyArrayInfo {
  values: Float32Array;
}

/**
 * What a `.npy` or `.npz` holds, without decoding any of it.
 *
 * Cheap enough to call during file-type detection: it reads headers, and for an
 * archive only its directory. Returns an empty list rather than throwing when
 * the file is not readable at all, because the callers use it to *decide*
 * whether they can handle the file.
 */
export async function inspectNpyWasm(data: Uint8Array): Promise<NpyArrayInfo[]> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  try {
    return JSON.parse(wasm.npy_inspect(data)) as NpyArrayInfo[];
  } catch {
    return [];
  }
}

/**
 * Decode one array. `name` selects a member of an `.npz`; it is ignored for a
 * plain `.npy`, and an empty name takes the archive's first array.
 */
export async function readNpyWasm(data: Uint8Array, name = ''): Promise<NpyArray> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  const raw = wasm.npy_read(data, name);
  const array: NpyArray = {
    name: raw.name,
    shape: Array.from(raw.shape),
    dtype: raw.dtype,
    values: raw.take_values(),
  };
  raw.free?.();
  return array;
}

/**
 * True when the array is a point list rather than an image: NumPy carries no
 * hint of its own, so the shape ending in 3 (`(N,3)`, `(H,W,3)`, and so on) is
 * the whole test - the same one the TypeScript parser used.
 */
export function isNpyPointCloudShape(shape: number[]): boolean {
  return shape.length >= 1 && shape[shape.length - 1] === 3;
}

export async function parseTextTableWasm(
  data: Uint8Array,
  options: unknown
): Promise<WasmPointCloudResult> {
  const wasm = await loadPointcloudWasm();
  if (!wasm) {
    throw new Error('point-cloud wasm unavailable');
  }
  return marshalWasmPointCloud(wasm.parse_text_table(data, JSON.stringify(options)));
}

/** A triangle mesh as packed buffers: what STL and OFF decode to. */
export interface WasmMesh {
  vertexCount: number;
  /** Triangles - polygons are already fan-triangulated. */
  triangleCount: number;
  positionsArray: Float32Array;
  normalsArray: Float32Array | null;
  colorsArray: Uint8Array | null;
  indicesArray: Uint32Array;
  hasNormals: boolean;
  hasColors: boolean;
}

function marshalMesh(raw: RawMeshResult): WasmMesh & { metadata: Record<string, unknown> } {
  const mesh = {
    vertexCount: raw.vertex_count,
    triangleCount: raw.triangle_count,
    hasNormals: raw.has_normals,
    hasColors: raw.has_colors,
    metadata: JSON.parse(raw.metadata_json) as Record<string, unknown>,
    positionsArray: raw.take_positions(),
    normalsArray: raw.has_normals ? raw.take_normals() : null,
    colorsArray: raw.has_colors ? raw.take_colors() : null,
    indicesArray: raw.take_indices(),
  };
  raw.free?.();
  return mesh;
}

async function requirePointcloudWasm(): Promise<PointcloudWasm> {
  const wasm = await loadPointcloudWasm();
  if (!wasm || typeof wasm.parse_stl !== 'function') {
    throw new Error('point-cloud wasm unavailable');
  }
  return wasm;
}

/** An STL, binary or ASCII, with its corners welded into an indexed mesh. */
export interface StlMesh extends WasmMesh {
  format: 'ascii' | 'binary';
  header: string;
  /** Whether the file itself coloured any facet (RGB565 attribute words). */
  sourceHasColors: boolean;
}

export async function parseStlWasm(data: Uint8Array): Promise<StlMesh> {
  const wasm = await requirePointcloudWasm();
  const { metadata, ...mesh } = marshalMesh(wasm.parse_stl(data));
  return {
    ...mesh,
    format: metadata.format as StlMesh['format'],
    header: String(metadata.header ?? ''),
    sourceHasColors: metadata.sourceHasColors === true,
  };
}

export interface OffMesh extends WasmMesh {
  offVariant: 'OFF' | 'COFF' | 'NOFF' | 'CNOFF';
  comments: string[];
}

/** Throws with the format's own message on a malformed file. */
export async function parseOffWasm(data: Uint8Array): Promise<OffMesh> {
  const wasm = await requirePointcloudWasm();
  const { metadata, ...mesh } = marshalMesh(wasm.parse_off(data));
  return {
    ...mesh,
    offVariant: metadata.variant as OffMesh['offVariant'],
    comments: (metadata.comments as string[]) ?? [],
  };
}

/**
 * An OBJ as packed buffers. Polygons are fan-triangulated into
 * `indicesArray`; `faceSizes` (null when every polygon is a triangle) and
 * `faceMaterials` keep the polygon structure that material groups need.
 * Material id 0 means "no usemtl"; names are indexed by id.
 */
export interface ObjMesh {
  vertexCount: number;
  positionsArray: Float32Array;
  /** The file's `vn` list, in file order. */
  normalsArray: Float32Array | null;
  normalCount: number;
  textureCoordCount: number;
  hasNormals: boolean;
  hasTextures: boolean;
  indicesArray: Uint32Array;
  faceCount: number;
  faceSizes: Uint32Array | null;
  faceMaterials: Uint32Array | null;
  lineIndices: Uint32Array;
  lineMaterials: Uint32Array | null;
  lineCount: number;
  pointIndices: Uint32Array;
  pointMaterials: Uint32Array | null;
  pointCount: number;
  materialNames: string[];
  materialFile?: string;
  currentMaterial?: string;
}

/** Throws when a face, line or point refers to a vertex that does not exist. */
export async function parseObjWasm(data: Uint8Array): Promise<ObjMesh> {
  const wasm = await requirePointcloudWasm();
  const raw = wasm.parse_obj(data);
  const optional = (array: Uint32Array) => (array.length > 0 ? array : null);
  const normalsArray = raw.take_normals();
  const lineIndices = raw.take_line_indices();
  const pointIndices = raw.take_point_indices();
  const obj: ObjMesh = {
    vertexCount: raw.vertex_count,
    positionsArray: raw.take_positions(),
    normalsArray: normalsArray.length > 0 ? normalsArray : null,
    normalCount: raw.normal_count,
    textureCoordCount: raw.texcoord_count,
    hasNormals: raw.normal_count > 0,
    hasTextures: raw.texcoord_count > 0,
    indicesArray: raw.take_indices(),
    faceCount: raw.face_count,
    faceSizes: optional(raw.take_face_sizes()),
    faceMaterials: optional(raw.take_face_materials()),
    lineIndices,
    lineMaterials: optional(raw.take_line_materials()),
    lineCount: lineIndices.length / 2,
    pointIndices,
    pointMaterials: optional(raw.take_point_materials()),
    pointCount: pointIndices.length,
    materialNames: raw.material_names,
    materialFile: raw.material_file || undefined,
    currentMaterial: raw.current_material || undefined,
  };
  raw.free?.();
  return obj;
}
