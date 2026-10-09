import * as fs from 'node:fs';
import type { WasmPointCloud } from '../wasmPointcloud';
import { loadRegistrationWasm } from '../../engine/src/registration/wasmLoader';
import type { TextRangeJob, TextRangeResult } from './parseWorker';
import { defaultParallelism, runParseJobs } from './parsePool';

/**
 * Parse a large text point cloud (XYZ/XYZN/XYZRGB, PTS, ASCII PLY or PCD
 * point clouds) on several threads at once.
 *
 * These formats were the slowest common loads by far: one thread parsing
 * ~180 MB/s meant 2-4 s for a 300-600 MB file, all of it before the webview
 * saw a single point. After the header, though, every line is an independent
 * point, so the main thread reads the header once (`plan_rows`), the workers
 * each parse a slice of the remaining bytes, and the slices are concatenated
 * in file order. The result is identical to the sequential parse - same
 * header readers, same row code - which the byte-for-byte comparison in the
 * Rust tests and docs/performance-method.md's checks rely on.
 *
 * Anything unexpected returns null and the caller uses its sequential path.
 */

/** Below this much row data, one thread finishes before a pool would help. */
const MIN_PARALLEL_BYTES = 32 * 1024 * 1024;
/** Smallest slice worth a worker; keeps tiny files on few threads. */
const MIN_SLICE_BYTES = 8 * 1024 * 1024;

/** How a text point cloud's rows are read; see `plan_rows` in the crate. */
interface RowPlan {
  layout: number[];
  color: number;
  /** Byte offset of the first data row. */
  start: number;
  /** Declared point count (PLY, PCD); 0 when the format has none. */
  expected: number;
}

async function planRows(
  head: Uint8Array,
  format: string,
  colorMode: string
): Promise<RowPlan | null> {
  const wasm = (await loadRegistrationWasm()) as unknown as {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- wasm-bindgen export
    plan_rows?(head: Uint8Array, format: string, colorMode: string): string;
  } | null;
  const json = wasm?.plan_rows?.(head, format, colorMode);
  return json ? (JSON.parse(json) as RowPlan) : null;
}

/** Overrides for tests, which need small files split many ways. */
export interface ParallelParseOptions {
  workers?: number;
  minParallelBytes?: number;
  minSliceBytes?: number;
}

function concat<T extends Float32Array | Uint8Array>(
  parts: (T | null)[],
  make: (length: number) => T
): T | null {
  if (parts.some(part => part === null)) {
    return null;
  }
  const total = parts.reduce((sum, part) => sum + part!.length, 0);
  const out = make(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part!, offset);
    offset += part!.length;
  }
  return out;
}

/** Mean line length of the sample's data rows (header excluded). */
function averageRowBytes(head: Uint8Array, start: number): number {
  let lines = 0;
  let last = start;
  for (let i = start; i < head.length; i++) {
    if (head[i] === 10) {
      lines++;
      last = i + 1;
    }
  }
  return lines > 0 ? (last - start) / lines : 32;
}

async function readHead(filePath: string): Promise<Uint8Array> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const head = Buffer.allocUnsafe(64 * 1024);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** One slice of a cloud, in file order, as `parallelStreamTextFile` emits it. */
export interface TextCloudPart {
  positions: Float32Array;
  colors: Uint8Array | null;
  normals: Float32Array | null;
  intensity: Float32Array | null;
}

/** What a streamed parse reports at the end; the arrays went out in parts. */
export type TextCloudSummary = Omit<
  WasmPointCloud,
  'positionsArray' | 'colorsArray' | 'normalsArray' | 'intensityArray'
>;

/**
 * Plan the file, parse its slices on the pool and hand each finished slice to
 * `emit` in file order - trimmed to a declared vertex count (PLY, PCD), which
 * ends the cloud there. Returns null when the file should take the
 * sequential path, before anything was emitted.
 */
async function parseSlices(
  filePath: string,
  format: string,
  colorMode: string,
  options: ParallelParseOptions,
  slicesPerWorker: number,
  emit: (part: TextRangeResult) => void
): Promise<{ plan: RowPlan } | null> {
  const size = (await fs.promises.stat(filePath)).size;
  const head = await readHead(filePath);
  const plan = await planRows(head, format, colorMode);
  const dataBytes = plan ? size - plan.start : 0;
  if (!plan || dataBytes < (options.minParallelBytes ?? MIN_PARALLEL_BYTES)) {
    return null;
  }
  const workers = options.workers ?? defaultParallelism();
  const count = Math.max(
    1,
    Math.min(
      workers * slicesPerWorker,
      Math.ceil(dataBytes / (options.minSliceBytes ?? MIN_SLICE_BYTES / slicesPerWorker))
    )
  );
  const slice = Math.ceil(dataBytes / count);
  const rowBytes = averageRowBytes(head, plan.start);

  // Slices finish roughly in order (each worker takes the next one); hold any
  // that finish early until everything before them is out.
  const ready = new Map<number, TextRangeResult>();
  let next = 0;
  let kept = 0;
  const release = (index: number, part: TextRangeResult) => {
    ready.set(index, part);
    while (ready.has(next)) {
      const current = ready.get(next)!;
      ready.delete(next);
      next++;
      const points = current.positions.length / 3;
      const room = plan.expected > 0 ? plan.expected - kept : points;
      if (room <= 0) {
        continue;
      }
      if (points <= room) {
        kept += points;
        emit(current);
      } else {
        kept += room;
        emit({
          positions: current.positions.subarray(0, room * 3),
          colors: current.colors?.subarray(0, room * 3) ?? null,
          normals: current.normals?.subarray(0, room * 3) ?? null,
          intensity: current.intensity?.subarray(0, room) ?? null,
          bbox: boundsOf(current.positions.subarray(0, room * 3)),
        });
      }
    }
  };
  await runParseJobs<TextRangeResult>(
    Array.from({ length: count }, (_, index) => ({
      message: {
        kind: 'text',
        file: filePath,
        start: plan.start + index * slice,
        end: Math.min(size, plan.start + (index + 1) * slice),
        layout: plan.layout,
        color: plan.color,
        rowBytes,
      } satisfies TextRangeJob,
    })),
    workers,
    release
  );
  return { plan };
}

/**
 * @param format `xyz` | `xyzn` | `xyzrgb` | `pts` | `ply` | `pcd`
 * @param colorMode the caller's `byte`/`unit` decision for XYZRGB
 */
export async function parallelParseTextFile(
  filePath: string,
  format: string,
  colorMode = 'auto',
  options: ParallelParseOptions = {}
): Promise<WasmPointCloud | null> {
  try {
    const parts: TextRangeResult[] = [];
    const planned = await parseSlices(filePath, format, colorMode, options, 1, part =>
      parts.push(part)
    );
    if (!planned) {
      return null;
    }
    const positions = concat(
      parts.map(part => part.positions),
      n => new Float32Array(n)
    )!;
    const colors = concat(
      parts.map(part => part.colors),
      n => new Uint8Array(n)
    );
    const normals = concat(
      parts.map(part => part.normals),
      n => new Float32Array(n)
    );
    const intensity = concat(
      parts.map(part => part.intensity),
      n => new Float32Array(n)
    );
    const vertexCount = positions.length / 3;
    return {
      vertexCount,
      positionsArray: positions,
      colorsArray: colors,
      normalsArray: normals,
      intensityArray: intensity,
      hasColors: colors !== null,
      hasNormals: normals !== null,
      hasIntensity: intensity !== null,
      bbox: summaryBounds(parts, vertexCount),
    };
  } catch (error) {
    console.warn('[pointcloud-wasm] parallel parse failed, using the sequential parser:', error);
    return null;
  }
}

/**
 * The same parse, but each slice goes to `onPart` as soon as it and every
 * slice before it are done - so the caller can send it on while the rest is
 * still parsing. The file is cut into more slices than there are workers for
 * that overlap. The concatenated parts equal `parallelParseTextFile`'s arrays.
 *
 * Returns null - and the caller must discard any parts it already received -
 * when the file should take the sequential path or the parse fails.
 */
export async function parallelStreamTextFile(
  filePath: string,
  format: string,
  colorMode: string,
  onPart: (part: TextCloudPart) => Promise<unknown>,
  options: ParallelParseOptions = {}
): Promise<TextCloudSummary | null> {
  let sending: Promise<unknown> = Promise.resolve();
  const sent: TextRangeResult[] = [];
  try {
    const planned = await parseSlices(filePath, format, colorMode, options, 4, part => {
      sent.push(part);
      const { bbox: _bbox, ...arrays } = part;
      sending = sending.then(() => onPart(arrays));
    });
    await sending;
    if (!planned) {
      return null;
    }
    const vertexCount = sent.reduce((sum, part) => sum + part.positions.length / 3, 0);
    const first = sent[0];
    return {
      vertexCount,
      hasColors: first ? first.colors !== null : false,
      hasNormals: first ? first.normals !== null : false,
      hasIntensity: first ? first.intensity !== null : false,
      bbox: summaryBounds(sent, vertexCount),
    };
  } catch (error) {
    console.warn('[pointcloud-wasm] parallel parse failed, using the sequential parser:', error);
    await sending.catch(() => undefined);
    return null;
  }
}

function summaryBounds(parts: TextRangeResult[], vertexCount: number): Float32Array {
  return vertexCount === 0
    ? new Float32Array(6)
    : mergeBounds(parts.filter(part => part.positions.length > 0).map(part => part.bbox));
}

function mergeBounds(boxes: Float32Array[]): Float32Array {
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (const part of boxes) {
    for (let axis = 0; axis < 3; axis++) {
      box[axis] = Math.min(box[axis], part[axis]);
      box[axis + 3] = Math.max(box[axis + 3], part[axis + 3]);
    }
  }
  return box;
}

/**
 * Bounds of the kept points, for the rare file with rows past its declared
 * count - merging the slices' boxes would include the dropped rows.
 */
function boundsOf(positions: Float32Array): Float32Array {
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[i + axis];
      if (value < box[axis]) {
        box[axis] = value;
      }
      if (value > box[axis + 3]) {
        box[axis + 3] = value;
      }
    }
  }
  return box;
}
