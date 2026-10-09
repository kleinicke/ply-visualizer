import { associateE57Images, parseLidarWasm, type WasmLidarCloud } from '../wasmPointcloud';
import {
  parseObjWasm,
  parseOffWasm,
  parsePcdWasm,
  parsePtsWasm,
  parseStlWasm,
  toPcdPayload,
  toPointCloudPayload,
} from '../../engine/src/parsers/pointcloudWasm';
import { loadRegistrationWasm } from '../../engine/src/registration/wasmLoader';
import type {
  DecodeFormat,
  DecodeJob,
  E57PlanResult,
  E57ScanJob,
  E57ScanResult,
  LasColorsJob,
  LasColorsResult,
  LasRangeJob,
  LasRangeResult,
  PlanJob,
} from './parseWorker';
import { defaultParallelism, runParseJobs } from './parsePool';
import { compactScalarFields } from '../../engine/src/utils/scalarFields';

/**
 * Decode a LAS or LAZ file on several threads at once.
 *
 * LAZ decompression ran at about 2.5 million points a second on one thread,
 * so a 50-million-point scan kept the user waiting some twenty seconds. LAZ is
 * stored in independently compressed chunks (and LAS records are fixed-size),
 * so the crate plans chunk-aligned point ranges (`las_range_plan`), each
 * worker decodes one from just the bytes it needs - the header, the chunk
 * table and its own chunks - and the ranges are concatenated in order.
 *
 * Everything that depends on the whole file is decided once: positions are
 * relative to the header's centre, GPS times to the file's first finite time
 * (found by the plan), and whether colours are 16-bit from every range's
 * channels together. The result is identical to `parse_las` - the Rust tests
 * compare them field by field at several splits.
 *
 * Returns null whenever the sequential decoder should be used instead.
 */

/** Below this, the sequential decoder finishes before workers would start. */
const MIN_PARALLEL_POINTS = 500_000;

interface RangePlan {
  pointCount: number;
  headEnd: number;
  tailStart: number;
  gpsOffset: number | null;
  sourceOrigin: [number, number, number];
  metadata: Record<string, unknown>;
  ranges: Array<{ first: number; count: number; byteStart: number; byteEnd: number }>;
}

interface E57Plan {
  pageSize: number;
  xmlStart: number;
  origin: [number, number, number] | null;
  originScan: number | null;
  imageCount: number;
  scans: Array<{ start: number; end: number; records: number }>;
}

/* eslint-disable @typescript-eslint/naming-convention -- wasm-bindgen surface */
interface LidarWasm {
  las_range_plan?(data: Uint8Array, parts: number): string;
  e57_scan_plan?(data: Uint8Array): string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface ParallelLidarOptions {
  workers?: number;
  minPoints?: number;
}

function concat<T extends Float32Array | Uint16Array>(parts: T[], make: (length: number) => T): T {
  const out = make(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * The bytes in shared memory, so every job of the file reads the same copy
 * (posting an ordinary view would clone its whole buffer per job).
 */
export function sharedBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.buffer instanceof SharedArrayBuffer) {
    return bytes;
  }
  const shared = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
  shared.set(bytes);
  return shared;
}

async function planInWorker<T>(kind: PlanJob['kind'], bytes: Uint8Array, parts: number) {
  const [result] = await runParseJobs<T>([{ message: { kind, bytes, parts } satisfies PlanJob }]);
  return result;
}

export async function parallelParseLas(
  bytes: Uint8Array,
  fileName: string,
  options: ParallelLidarOptions = {}
): Promise<WasmLidarCloud | null> {
  try {
    const wasm = (await loadRegistrationWasm()) as unknown as LidarWasm | null;
    if (!wasm?.las_range_plan) {
      return null;
    }
    const shared = sharedBytes(bytes);
    const plan = JSON.parse(
      await planInWorker<string>('lasPlan', shared, options.workers ?? defaultParallelism())
    ) as RangePlan;
    if (plan.pointCount < (options.minPoints ?? MIN_PARALLEL_POINTS) || plan.ranges.length < 2) {
      return null;
    }
    const fileLen = bytes.byteLength;
    const gpsOffset = plan.gpsOffset ?? Number.NaN;
    const parts = await runParseJobs<LasRangeResult>(
      plan.ranges.map(range => {
        const message: LasRangeJob = {
          kind: 'las',
          bytes: shared,
          headEnd: plan.headEnd,
          tailStart: plan.tailStart,
          bodyStart: range.byteStart,
          bodyEnd: range.byteEnd,
          job: JSON.stringify({
            fileLen,
            tailStart: plan.tailStart,
            bodyStart: range.byteStart,
            first: range.first,
            count: range.count,
          }),
          gpsOffset,
        };
        return { message };
      })
    );

    const floats = (pick: (part: LasRangeResult) => Float32Array) =>
      concat(parts.map(pick), n => new Float32Array(n));
    const positions = floats(part => part.positions);
    const colors16 = concat(
      parts.map(part => part.colors16),
      n => new Uint16Array(n)
    );
    const hasColors = colors16.length > 0;
    let colors: Uint8Array | null = null;
    let colorEncoding: string | null = null;
    if (hasColors) {
      const [converted] = await runParseJobs<LasColorsResult>([
        {
          message: {
            kind: 'lasColors',
            colors16,
            maxColor: Math.max(...parts.map(part => part.maxColor)),
            aboveByte: parts.reduce((sum, part) => sum + part.colorChannelsAboveByte, 0),
          } satisfies LasColorsJob,
          transfer: [colors16.buffer as ArrayBuffer],
        },
      ]);
      colorEncoding = converted.encoding;
      colors = converted.colors;
    }

    const scalarFields: Record<string, Float32Array> = {};
    const fields: Array<[string, (part: LasRangeResult) => Float32Array]> = [
      ['intensity', part => part.intensity],
      ['classification', part => part.classification],
      ['returnNumber', part => part.returnNumber],
      ['numberOfReturns', part => part.numberOfReturns],
      ['scanAngle', part => part.scanAngle],
      ['gpsTime', part => part.gpsTime],
      ['userData', part => part.userData],
      ['pointSourceId', part => part.pointSourceId],
    ];
    for (const [name, pick] of fields) {
      const values = floats(pick);
      if (values.length > 0) {
        scalarFields[name] = values;
      }
    }

    const bbox = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    for (const part of parts) {
      for (let axis = 0; axis < 3; axis++) {
        bbox[axis] = Math.min(bbox[axis], part.bounds[axis]);
        bbox[axis + 3] = Math.max(bbox[axis + 3], part.bounds[axis + 3]);
      }
    }
    if (!Number.isFinite(bbox[0])) {
      bbox.fill(0);
    }

    return {
      name: fileName,
      vertexCount: positions.length / 3,
      sourcePointCount: plan.pointCount,
      hasColors,
      hasNormals: false,
      hasIntensity: !!scalarFields.intensity,
      positionsArray: positions,
      colorsArray: colors,
      normalsArray: null,
      intensityArray: scalarFields.intensity ?? null,
      scalarFields,
      metadata: { ...plan.metadata, colorEncoding, gpsTimeOffset: plan.gpsOffset },
      sourceOrigin: Float64Array.from(plan.sourceOrigin),
      bbox,
    };
  } catch (error) {
    console.warn('[pointcloud-wasm] parallel LAS decode failed, using the sequential one:', error);
    return null;
  }
}

/**
 * Decode a multi-scan E57 one scan per worker.
 *
 * E57 scans are separate compressed sections, decoded in sequence by the
 * whole-file reader. Here each worker gets one scan's section (plus the
 * header page and the XML) and the results come back in scan order. The two
 * things that cross scans are reproduced exactly: every scan is rebased on
 * the file's first valid point (found by the plan), and decode errors are
 * merged under the same twenty-record cap. Images are read here, after the
 * scans, as before.
 */
export async function parallelParseE57(
  bytes: Uint8Array,
  fileName: string,
  options: ParallelLidarOptions = {}
): Promise<WasmLidarCloud[] | null> {
  try {
    const wasm = (await loadRegistrationWasm()) as unknown as LidarWasm | null;
    if (!wasm?.e57_scan_plan) {
      return null;
    }
    const shared = sharedBytes(bytes);
    const planned = await planInWorker<E57PlanResult>('e57Plan', shared, 1);
    const plan = JSON.parse(planned.plan) as E57Plan;
    const points = plan.scans.reduce((sum, scan) => sum + scan.records, 0);
    if (plan.scans.length < 2 || points < (options.minPoints ?? MIN_PARALLEL_POINTS)) {
      return null;
    }
    const origin = plan.origin ?? [0, 0, 0];
    // Largest scans first, so the longest job does not start last.
    const order = plan.scans.map((_, index) => index);
    order.sort((a, b) => plan.scans[b].records - plan.scans[a].records);
    const decoded = await runParseJobs<E57ScanResult>(
      order.map(index => {
        const span = plan.scans[index];
        const message: E57ScanJob = {
          kind: 'e57',
          bytes: shared,
          pageSize: plan.pageSize,
          xmlStart: plan.xmlStart,
          bodyStart: span.start,
          bodyEnd: span.end,
          job: JSON.stringify({
            fileLen: bytes.byteLength,
            xmlStart: plan.xmlStart,
            bodyStart: span.start,
            scanIndex: index,
            fileName,
            hasOrigin: plan.originScan !== null && index >= plan.originScan,
          }),
          origin,
        };
        return { message };
      }),
      options.workers ?? defaultParallelism()
    );
    const byScan: E57ScanResult[] = new Array(plan.scans.length);
    order.forEach((index, position) => {
      byScan[index] = decoded[position];
    });

    const scans: WasmLidarCloud[] = [];
    const errors: string[] = [];
    for (const result of byScan) {
      if (result.scan) {
        scans.push(result.scan);
        // Record errors count against one cap across the file.
        for (const error of result.errors) {
          if (errors.length < 20) {
            errors.push(error);
          }
        }
      } else {
        errors.push(...result.errors);
      }
    }
    if (scans.length === 0) {
      // The sequential decoder reports this case with its own message.
      return null;
    }
    // Images were read with the plan, in the same worker.
    associateE57Images(scans, planned.images);
    if (errors.length) {
      console.warn(`[pointcloud-wasm] ${fileName} loaded with decoder warnings:`, errors);
    }
    return scans;
  } catch (error) {
    console.warn('[pointcloud-wasm] parallel E57 decode failed, using the sequential one:', error);
    return null;
  }
}

/**
 * Decode LAS, LAZ or E57: large LAS/LAZ files by point range and multi-scan
 * E57s by scan, in parallel; everything else - and any failure of the
 * parallel paths - with the sequential decoder.
 */
export async function decodeLidar(
  bytes: Uint8Array,
  extension: 'las' | 'laz' | 'e57',
  fileName: string
): Promise<WasmLidarCloud[]> {
  // Small whole-number attributes (classification, return numbers, ...) are
  // stored and sent at their natural width - see compactScalarFields.
  const compacted = (clouds: WasmLidarCloud[]) => {
    for (const cloud of clouds) {
      cloud.scalarFields = compactScalarFields(cloud.scalarFields) ?? {};
    }
    return clouds;
  };
  if (extension === 'e57') {
    const scans = await parallelParseE57(bytes, fileName);
    if (scans) {
      return compacted(scans);
    }
  } else {
    const parallel = await parallelParseLas(bytes, fileName);
    if (parallel) {
      return compacted([parallel]);
    }
  }
  return compacted(await decodeInWorker<WasmLidarCloud[]>(extension, bytes, fileName));
}

/**
 * Decode a whole file with one of the sequential decoders, in a worker - so
 * the extension host stays responsive and its own wasm memory stays small.
 * Falls back to decoding here if the worker cannot run.
 */
export async function decodeInWorker<T>(
  format: DecodeFormat,
  bytes: Uint8Array,
  fileName: string
): Promise<T> {
  try {
    const [result] = await runParseJobs<T>([
      {
        message: {
          kind: 'decode',
          format,
          bytes: sharedBytes(bytes),
          fileName,
        } satisfies DecodeJob,
      },
    ]);
    return result;
  } catch (error) {
    if (!(error instanceof Error) || !/decoder worker|Cannot find module/.test(error.message)) {
      // The decoder itself rejected the file; doing it again here would only
      // repeat the error.
      throw error;
    }
    console.warn('[pointcloud-wasm] decoder worker unavailable, decoding in-process:', error);
    return (await decodeInProcess(format, bytes, fileName)) as T;
  }
}

async function decodeInProcess(format: DecodeFormat, bytes: Uint8Array, fileName: string) {
  switch (format) {
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
    default:
      return parseLidarWasm(bytes, format, fileName);
  }
}
