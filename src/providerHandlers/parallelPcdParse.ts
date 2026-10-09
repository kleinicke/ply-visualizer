import {
  toPcdPayload,
  type PcdHeaderInfo,
  type WasmPointCloudResult,
} from '../../engine/src/parsers/pointcloudWasm';
import { loadRegistrationWasm } from '../../engine/src/registration/wasmLoader';
import type { PcdRangeJob } from './parseWorker';
import { defaultParallelism, runParseJobs } from './parsePool';
import { sharedBytes } from './parallelLidarParse';

/**
 * `DATA binary` PCD files decoded in row ranges on the decoder threads.
 *
 * The records are fixed-size, so the file splits into independent ranges and
 * each worker decodes its own (`parse_pcd_binary_range`); the parts are
 * concatenated in row order into exactly the payload one `parse_pcd` produces -
 * positions, colours, normals, intensity, every extra field, and the
 * source-row map of an organized cloud with NaN rows. One thread took about
 * 300 ms of an eight-million-point file's load.
 *
 * Null for anything else (ASCII, `binary_compressed`, a small cloud); the
 * caller then decodes the whole file in one worker as before.
 */

const MIN_PARALLEL_ROWS = 1_000_000;

/* eslint-disable @typescript-eslint/naming-convention -- wasm-bindgen surface */
interface PcdPlanWasm {
  pcd_binary_plan?(head: Uint8Array): string;
}
/* eslint-enable @typescript-eslint/naming-convention */

function join<T extends Float32Array | Uint8Array | Uint32Array>(
  parts: Array<T | null | undefined>,
  make: (length: number) => T
): T | null {
  if (parts.some(part => !part)) {
    return null;
  }
  const out = make(parts.reduce((sum, part) => sum + part!.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part!, offset);
    offset += part!.length;
  }
  return out;
}

export async function parallelParsePcd(
  bytes: Uint8Array,
  { workers = defaultParallelism(), minRows = MIN_PARALLEL_ROWS } = {}
): Promise<Record<string, unknown> | null> {
  const wasm = (await loadRegistrationWasm()) as unknown as PcdPlanWasm | null;
  const planJson = wasm?.pcd_binary_plan?.(bytes.subarray(0, Math.min(bytes.length, 65536)));
  if (!planJson) {
    return null;
  }
  const plan = JSON.parse(planJson) as { dataStart: number; stride: number; rows: number };
  // Whole records actually present, as `parse_pcd` clamps them.
  const rows = Math.min(plan.rows, Math.floor((bytes.length - plan.dataStart) / plan.stride));
  if (rows < minRows || workers < 2) {
    return null;
  }
  const shared = sharedBytes(bytes);
  const perPart = Math.ceil(rows / workers);
  const jobs: Array<{ message: PcdRangeJob }> = [];
  for (let firstRow = 0; firstRow < rows; firstRow += perPart) {
    const count = Math.min(perPart, rows - firstRow);
    jobs.push({
      message: {
        kind: 'pcdRange',
        bytes: shared,
        headEnd: plan.dataStart,
        bodyStart: plan.dataStart + firstRow * plan.stride,
        bodyEnd: plan.dataStart + (firstRow + count) * plan.stride,
        firstRow,
      },
    });
  }
  const parts = await runParseJobs<WasmPointCloudResult>(jobs, workers);

  const positions = join(
    parts.map(part => part.positionsArray),
    n => new Float32Array(n)
  )!;
  const vertexCount = positions.length / 3;
  const first = parts[0];
  const indexParts = parts.map(part => part.sourcePointIndices ?? new Uint32Array(0));
  // As parse_pcd: when every row was kept, say so instead of a map.
  const identity = vertexCount === rows;
  const bbox = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (const part of parts) {
    if (part.vertexCount === 0) {
      continue;
    }
    for (let axis = 0; axis < 3; axis++) {
      bbox[axis] = Math.min(bbox[axis], part.bbox[axis]);
      bbox[axis + 3] = Math.max(bbox[axis + 3], part.bbox[axis + 3]);
    }
  }
  const scalarFields: Record<string, Float32Array> = {};
  for (const name of Object.keys(first.scalarFields ?? {})) {
    scalarFields[name] = join(
      parts.map(part => part.scalarFields?.[name]),
      n => new Float32Array(n)
    )!;
  }
  const joined: WasmPointCloudResult = {
    vertexCount,
    positionsArray: positions,
    colorsArray: first.hasColors
      ? join(
          parts.map(part => part.colorsArray),
          n => new Uint8Array(n)
        )
      : null,
    normalsArray: first.hasNormals
      ? join(
          parts.map(part => part.normalsArray),
          n => new Float32Array(n)
        )
      : null,
    intensityArray: first.hasIntensity
      ? join(
          parts.map(part => part.intensityArray),
          n => new Float32Array(n)
        )
      : null,
    hasColors: first.hasColors,
    hasNormals: first.hasNormals,
    hasIntensity: first.hasIntensity,
    bbox: vertexCount === 0 ? new Float32Array(6) : bbox,
    metadataJson: first.metadataJson,
    scalarFields,
    sourcePointCount: rows,
    sourcePointIndices: identity ? undefined : join(indexParts, n => new Uint32Array(n))!,
    sourceRowsIdentity: identity || undefined,
  };
  return toPcdPayload({ ...joined, header: JSON.parse(joined.metadataJson) as PcdHeaderInfo });
}
