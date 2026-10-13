import { parentPort, workerData } from 'node:worker_threads';
import { loadWebGlue } from './pointcloudWebGlue';
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { loadRegistrationWasm } from '../../engine/src/registration/wasmLoader';
import {
  marshalLidarScan,
  parseLidarWasm,
  takeE57Images,
  type WasmE57Image,
  type WasmLidarCloud,
} from '../wasmPointcloud';
import {
  marshalWasmPointCloud,
  parseObjWasm,
  parseOffWasm,
  parsePcdWasm,
  parsePtsWasm,
  parseStlWasm,
  toPcdPayload,
  toPointCloudPayload,
} from '../../engine/src/parsers/pointcloudWasm';
import {
  runStonexColourScanJob,
  runStonexDecodeScanJob,
  type StonexColourScanJob,
  type StonexDecodeScanJob,
  type StonexWasm,
} from '../../engine/src/parsers/stonexWasm';
import {
  runStonexStationJob,
  type StonexStationJob,
} from '../../engine/src/parsers/stonexStationColoring';

/**
 * One worker of the extension host's decoders (see parsePool.ts).
 *
 * Decoding here rather than on the extension host's own thread keeps that
 * thread free - a 28-million-point E57 used to block it for eight seconds,
 * long enough that not even the webview's "ready" message was handled - and
 * keeps its wasm instance small: wasm memory never shrinks, so every large
 * file decoded there left its peak allocated for the life of the session.
 * A worker is released shortly after its last job, and its memory with it.
 *
 * Kinds of job:
 * - `decode`: a whole file in one of the sequential decoders.
 * - `text`: a byte range of a text point cloud (parallelTextParse.ts).
 * - `lasPlan`/`las`: the plan and one point range of a LAS/LAZ file, and
 *   `e57Plan`/`e57`: the plan and one scan of an E57 (parallelLidarParse.ts).
 * - `stonexColour`: one group of X3A scans coloured from their photographs,
 *   `stonexDecode`: one X3A scan record decoded from shared memory, and
 *   `stonexStation`: an archive coloured from every station, reporting each
 *   scan as it lands in the shared arrays (parallelStonexColour.ts).
 *
 * File bytes arrive in a SharedArrayBuffer (readFileShared), so the jobs of
 * one file share them; each passes only its own part to wasm.
 *
 * For text, each job is a byte range of the file. The worker owns exactly the
 * lines that *start* inside it, which it finds by moving both ends forward to
 * the next line start - the neighbouring worker moves the shared boundary the
 * same way, so every line is parsed once. It reads the range itself (the reads
 * run in parallel too), a few megabytes at a time, and parses it with the plan
 * the main thread derived from the header.
 */

// Instantiate the crate from the module the pool compiled once (see
// parsePool.ts), and offer it to both loaders before either loads its own.
const providedModule = (workerData as { wasmModule?: WebAssembly.Module } | null)?.wasmModule;
const glue = providedModule ? loadWebGlue() : null;
if (providedModule && glue) {
  const instance = glue.initSync({ module: providedModule });
  (globalThis as { plySharedPointcloudWasm?: unknown }).plySharedPointcloudWasm = {
    ...glue,
    memory: instance.memory,
  };
}

/** A whole file through one of the sequential decoders. */
export interface DecodeJob {
  kind: 'decode';
  format: DecodeFormat;
  bytes: Uint8Array;
  fileName: string;
}

export type DecodeFormat = 'stl' | 'obj' | 'off' | 'pcd' | 'pts' | 'las' | 'laz' | 'e57';

/** Plan a LAS/LAZ split (`las_range_plan`), or an E57 split plus its images. */
export interface PlanJob {
  kind: 'lasPlan' | 'e57Plan';
  bytes: Uint8Array;
  parts: number;
}

/** The whole file's 16-bit LAS colours to bytes, with the encoding decided once. */
export interface LasColorsJob {
  kind: 'lasColors';
  colors16: Uint16Array;
  maxColor: number;
  aboveByte: number;
}

export interface LasColorsResult {
  colors: Uint8Array;
  encoding: string;
}

export interface E57PlanResult {
  plan: string;
  images: WasmE57Image[];
}

/**
 * One row range of a `DATA binary` PCD: the header `[0, headEnd)` and the
 * range's records `[bodyStart, bodyEnd)` of the shared file bytes.
 */
export interface PcdRangeJob {
  kind: 'pcdRange';
  bytes: Uint8Array;
  headEnd: number;
  bodyStart: number;
  bodyEnd: number;
  firstRow: number;
}

export interface TextRangeJob {
  kind: 'text';
  file: string;
  start: number;
  end: number;
  layout: number[];
  color: number;
  /** Average row length in the header sample, to pre-size the output. */
  rowBytes: number;
}

export interface TextRangeResult {
  positions: Float32Array;
  colors: Uint8Array | null;
  normals: Float32Array | null;
  intensity: Float32Array | null;
  /** [minX, minY, minZ, maxX, maxY, maxZ] of this range. */
  bbox: Float32Array;
}

/**
 * A LAS/LAZ range: the header region `[0, headEnd)`, the tail (LAZ chunk
 * table, EVLRs) from `tailStart`, and the range's own points
 * `[bodyStart, bodyEnd)` of the shared file bytes.
 */
export interface LasRangeJob {
  kind: 'las';
  bytes: Uint8Array;
  headEnd: number;
  tailStart: number;
  bodyStart: number;
  bodyEnd: number;
  /** `{ fileLen, tailStart, bodyStart, first, count }` for the crate. */
  job: string;
  /** The file's GPS offset, NaN when it has none; a float, not in the JSON. */
  gpsOffset: number;
}

export interface LasRangeResult {
  positions: Float32Array;
  /** Raw 16-bit RGB; the 8-bit decision is made over the whole file. */
  colors16: Uint16Array;
  maxColor: number;
  colorChannelsAboveByte: number;
  bounds: Float32Array;
  intensity: Float32Array;
  classification: Float32Array;
  returnNumber: Float32Array;
  numberOfReturns: Float32Array;
  scanAngle: Float32Array;
  gpsTime: Float32Array;
  userData: Float32Array;
  pointSourceId: Float32Array;
}

/**
 * One E57 scan: the first page `[0, pageSize)`, the XML region from
 * `xmlStart` and the scan's own section `[bodyStart, bodyEnd)`.
 */
export interface E57ScanJob {
  kind: 'e57';
  bytes: Uint8Array;
  pageSize: number;
  xmlStart: number;
  bodyStart: number;
  bodyEnd: number;
  /** `{ fileLen, xmlStart, bodyStart, scanIndex, fileName, hasOrigin }`. */
  job: string;
  /** The common origin; floats, so not in the JSON. */
  origin: [number, number, number];
}

export interface E57ScanResult {
  scan: WasmLidarCloud | null;
  errors: string[];
}

/* eslint-disable @typescript-eslint/naming-convention -- wasm-bindgen surface */
interface RawLasRange {
  max_color: number;
  color_channels_above_byte: number;
  bounds(): Float32Array;
  take_positions(): Float32Array;
  take_colors16(): Uint16Array;
  take_intensity(): Float32Array;
  take_classification(): Float32Array;
  take_return_number(): Float32Array;
  take_number_of_returns(): Float32Array;
  take_scan_angle(): Float32Array;
  take_gps_time(): Float32Array;
  take_user_data(): Float32Array;
  take_point_source_id(): Float32Array;
  free(): void;
}
interface RowResult {
  has_colors: boolean;
  has_normals: boolean;
  has_intensity: boolean;
  take_positions(): Float32Array;
  take_colors(): Uint8Array;
  take_normals(): Float32Array;
  take_intensity(): Float32Array;
  bbox(): Float32Array;
  free(): void;
}
interface RowWasm {
  las_colors_to_bytes(
    colors16: Uint16Array,
    maxColor: number,
    aboveByte: number
  ): { encoding: string; take_colors(): Uint8Array; free(): void };
  las_range_plan(data: Uint8Array, parts: number): string;
  parse_pcd_binary_range(head: Uint8Array, body: Uint8Array, firstRow: number): unknown;
  e57_scan_plan(data: Uint8Array): string;
  e57_images_only(data: Uint8Array, x: number, y: number, z: number, hasOrigin: boolean): unknown;
  parse_e57_scan(
    head: Uint8Array,
    xml: Uint8Array,
    body: Uint8Array,
    job: string,
    x: number,
    y: number,
    z: number
  ): { take_scan(): unknown; errors_json: string; free(): void };
  parse_las_range(
    head: Uint8Array,
    tail: Uint8Array,
    body: Uint8Array,
    job: string,
    gpsOffset: number
  ): RawLasRange;
  row_stream(
    layout: Uint8Array,
    color: number,
    rowsHint: number
  ): { push(chunk: Uint8Array): void; finish(): RowResult; free(): void };
}
/* eslint-enable @typescript-eslint/naming-convention */

/** The first line start at or after `position`. */
function lineStart(fd: number, position: number, size: number): number {
  if (position <= 0) {
    return 0;
  }
  if (position >= size) {
    return size;
  }
  const probe = Buffer.allocUnsafe(64 * 1024);
  let at = position - 1;
  for (;;) {
    const read = readSync(fd, probe, 0, probe.length, at);
    if (read === 0) {
      return size;
    }
    const newline = probe.subarray(0, read).indexOf(10);
    if (newline >= 0) {
      return at + newline + 1;
    }
    at += read;
  }
}

/** Read size per step: small enough that the range never sits in memory whole. */
const CHUNK_BYTES = 4 * 1024 * 1024;

function parseRange(wasm: RowWasm, fd: number, begin: number, end: number, job: TextRangeJob) {
  // A little over the sample's rate; a range of shorter rows just grows.
  const rowsHint = Math.ceil(((end - begin) / Math.max(1, job.rowBytes)) * 1.1);
  const stream = wasm.row_stream(
    Uint8Array.from(job.layout),
    job.color,
    Math.min(rowsHint, 2 ** 32 - 1)
  );
  const chunk = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, Math.max(1, end - begin)));
  let at = begin;
  while (at < end) {
    const read = readSync(fd, chunk, 0, Math.min(chunk.length, end - at), at);
    if (read === 0) {
      stream.free();
      throw new Error(`File ended early while reading bytes ${at}..${end}`);
    }
    stream.push(chunk.subarray(0, read));
    at += read;
  }
  const raw = stream.finish();
  stream.free();
  return raw;
}

function textRange(
  wasm: RowWasm,
  job: TextRangeJob
): {
  result: TextRangeResult;
  transfer: ArrayBuffer[];
} {
  const fd = openSync(job.file, 'r');
  let raw: RowResult;
  try {
    const size = fstatSync(fd).size;
    raw = parseRange(wasm, fd, lineStart(fd, job.start, size), lineStart(fd, job.end, size), job);
  } finally {
    closeSync(fd);
  }
  const result: TextRangeResult = {
    positions: raw.take_positions(),
    colors: raw.has_colors ? raw.take_colors() : null,
    normals: raw.has_normals ? raw.take_normals() : null,
    intensity: raw.has_intensity ? raw.take_intensity() : null,
    bbox: raw.bbox(),
  };
  raw.free();
  const transfer = [result.positions, result.colors, result.normals, result.intensity]
    .filter((array): array is NonNullable<typeof array> => array !== null)
    .map(array => array.buffer as ArrayBuffer);
  return { result, transfer };
}

function lasRange(
  wasm: RowWasm,
  job: LasRangeJob
): { result: LasRangeResult; transfer: ArrayBuffer[] } {
  const { bytes } = job;
  const raw = wasm.parse_las_range(
    bytes.subarray(0, job.headEnd),
    bytes.subarray(job.tailStart),
    bytes.subarray(job.bodyStart, job.bodyEnd),
    job.job,
    job.gpsOffset
  );
  const result: LasRangeResult = {
    maxColor: raw.max_color,
    colorChannelsAboveByte: raw.color_channels_above_byte,
    bounds: raw.bounds(),
    positions: raw.take_positions(),
    colors16: raw.take_colors16(),
    intensity: raw.take_intensity(),
    classification: raw.take_classification(),
    returnNumber: raw.take_return_number(),
    numberOfReturns: raw.take_number_of_returns(),
    scanAngle: raw.take_scan_angle(),
    gpsTime: raw.take_gps_time(),
    userData: raw.take_user_data(),
    pointSourceId: raw.take_point_source_id(),
  };
  raw.free();
  const transfer = Object.values(result)
    .filter((value): value is Float32Array | Uint16Array => ArrayBuffer.isView(value))
    .map(array => array.buffer as ArrayBuffer);
  return { result, transfer };
}

function e57Scan(
  wasm: RowWasm,
  job: E57ScanJob
): { result: E57ScanResult; transfer: ArrayBuffer[] } {
  const { bytes } = job;
  const raw = wasm.parse_e57_scan(
    bytes.subarray(0, job.pageSize),
    bytes.subarray(job.xmlStart),
    bytes.subarray(job.bodyStart, job.bodyEnd),
    job.job,
    ...job.origin
  );
  const decoded = raw.take_scan();
  const errors = JSON.parse(raw.errors_json) as string[];
  raw.free();
  const scan = decoded ? marshalLidarScan(decoded) : null;
  // A Set: the intensity array is also listed among the scalar fields, and a
  // transfer list must not name one buffer twice.
  const buffers = new Set<ArrayBuffer>();
  if (scan) {
    for (const array of [
      scan.positionsArray,
      scan.colorsArray,
      scan.intensityArray,
      scan.sourceOrigin,
      scan.bbox,
      ...Object.values(scan.scalarFields),
    ]) {
      if (array) {
        buffers.add(array.buffer as ArrayBuffer);
      }
    }
  }
  return { result: { scan, errors }, transfer: [...buffers] };
}

/** Every non-shared buffer reachable from a result, each listed once. */
function transferables(value: unknown, found = new Set<ArrayBuffer>()): ArrayBuffer[] {
  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) {
      found.add(value.buffer);
    }
  } else if (Array.isArray(value)) {
    value.forEach(item => transferables(item, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => transferables(item, found));
  }
  return [...found];
}

async function decode(job: DecodeJob): Promise<unknown> {
  // Wasm takes ordinary memory; the shared view is copied into it either way.
  const bytes = job.bytes;
  switch (job.format) {
    case 'stl':
      return parseStlWasm(bytes);
    case 'obj':
      return parseObjWasm(bytes);
    case 'off':
      return parseOffWasm(bytes);
    case 'pcd':
      return toPcdPayload(await parsePcdWasm(bytes));
    case 'pts':
      return toPointCloudPayload(await parsePtsWasm(bytes), 'pts');
    case 'las':
    case 'laz':
    case 'e57':
      return parseLidarWasm(bytes, job.format, job.fileName);
  }
}

function plan(wasm: RowWasm, job: PlanJob): string | E57PlanResult {
  if (job.kind === 'lasPlan') {
    return wasm.las_range_plan(job.bytes, job.parts);
  }
  const plan = wasm.e57_scan_plan(job.bytes);
  const parsed = JSON.parse(plan) as { imageCount: number; origin: number[] | null };
  let images: WasmE57Image[] = [];
  if (parsed.imageCount > 0) {
    const origin = parsed.origin ?? [0, 0, 0];
    const collection = wasm.e57_images_only(
      job.bytes,
      origin[0],
      origin[1],
      origin[2],
      parsed.origin !== null
    ) as { free(): void };
    try {
      images = takeE57Images(collection);
    } finally {
      collection.free();
    }
  }
  return { plan, images };
}

/** One X3A scan record to decode, read from shared memory (parallelStonexColour.ts). */
export interface StonexDecodeJob extends StonexDecodeScanJob {
  kind: 'stonexDecode';
}

/** A group of X3A scans to colour from their photographs (parallelStonexColour.ts). */
export interface StonexColourJob extends StonexColourScanJob {
  kind: 'stonexColour';
}

/** An X3A archive coloured from every station, in shared memory (parallelStonexColour.ts). */
export interface StonexStationColourJob extends StonexStationJob {
  kind: 'stonexStation';
}

type Job =
  | TextRangeJob
  | LasRangeJob
  | E57ScanJob
  | DecodeJob
  | PlanJob
  | LasColorsJob
  | PcdRangeJob
  | StonexColourJob
  | StonexDecodeJob
  | StonexStationColourJob;

async function run(
  wasm: RowWasm,
  job: Job,
  progress: (value: unknown) => void
): Promise<{ result: unknown; transfer: ArrayBuffer[] }> {
  switch (job.kind) {
    case 'las':
      return lasRange(wasm, job);
    case 'e57':
      return e57Scan(wasm, job);
    case 'text':
      return textRange(wasm, job);
    case 'pcdRange': {
      // Wasm takes ordinary memory; the shared views are copied into it.
      const raw = wasm.parse_pcd_binary_range(
        job.bytes.subarray(0, job.headEnd),
        job.bytes.subarray(job.bodyStart, job.bodyEnd),
        job.firstRow
      );
      const result = marshalWasmPointCloud(raw as never);
      return { result, transfer: transferables(result) };
    }
    case 'decode': {
      const result = await decode(job);
      return { result, transfer: transferables(result) };
    }
    case 'stonexDecode': {
      const result = runStonexDecodeScanJob(wasm as unknown as StonexWasm, job);
      return {
        result,
        transfer: [
          result.positions.buffer as ArrayBuffer,
          result.intensity.buffer as ArrayBuffer,
          result.azimuths.buffer as ArrayBuffer,
          result.counts.buffer as ArrayBuffer,
        ],
      };
    }
    case 'stonexColour': {
      const result = runStonexColourScanJob(wasm as unknown as StonexWasm, job);
      return {
        result,
        transfer: [
          ...result.scans.flatMap(scan => [
            scan.colours.buffer as ArrayBuffer,
            scan.frameIndices.buffer as ArrayBuffer,
          ]),
          ...result.previews.map(preview => preview.rgba.buffer as ArrayBuffer),
        ],
      };
    }
    case 'stonexStation': {
      // Results land in the job's shared arrays; each scan is reported as it
      // is written so the host can publish it.
      const result = await runStonexStationJob(wasm as unknown as StonexWasm, job, progress);
      return { result, transfer: [] };
    }
    case 'lasColors': {
      const converted = wasm.las_colors_to_bytes(job.colors16, job.maxColor, job.aboveByte);
      const result: LasColorsResult = {
        encoding: converted.encoding,
        colors: converted.take_colors(),
      };
      converted.free();
      return { result, transfer: [result.colors.buffer as ArrayBuffer] };
    }
    default: {
      const result = plan(wasm, job);
      return { result, transfer: transferables(result) };
    }
  }
}

parentPort!.on('message', async ({ id, job }: { id: number; job: Job }) => {
  try {
    const wasm = (await loadRegistrationWasm()) as unknown as RowWasm | null;
    if (!wasm || typeof wasm.row_stream !== 'function') {
      throw new Error('The point-cloud WebAssembly module failed to load.');
    }
    const { result, transfer } = await run(wasm, job, progress =>
      parentPort!.postMessage({ id, progress })
    );
    // The pool retires a worker whose memory a job grew large (parsePool.ts).
    const memory = (globalThis as { plySharedPointcloudWasm?: { memory?: WebAssembly.Memory } })
      .plySharedPointcloudWasm?.memory;
    parentPort!.postMessage({ id, result, wasmBytes: memory?.buffer.byteLength }, transfer);
  } catch (error) {
    parentPort!.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
