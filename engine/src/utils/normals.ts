import type { SpatialData } from '../interfaces';

/**
 * Point-cloud normals kept as signed-normalized 16-bit integers.
 *
 * A point cloud's normals never reach the GPU (points are not lit, see
 * MeshBuilder); they are kept for export, the normals view and the agent
 * tools. As floats that is 12 bytes per point; as snorm16 it is 6, with a
 * step of 1/32767 per component - about 0.002 degrees, far below anything a
 * normal is used for. Only unit-range values are packed: a file whose normals
 * are not normalized keeps them exactly as they were. Meshes keep Float32
 * normals, which are their lighting attribute.
 *
 * Packing happens once the cloud is built in the webview; parsers and the
 * host-to-webview transfer always carry Float32 normals.
 */
export type NormalArray = Float32Array | Int16Array;

const SNORM16 = 32767;

/** Pack a point cloud's unit normals to snorm16 (no-op for meshes and non-unit values). */
export function compactPointNormals(data: SpatialData): void {
  const normals = data.normalsArray;
  const isMesh = (data.faces?.length || 0) > 0 || (data.faceCount || 0) > 0;
  if (!(normals instanceof Float32Array) || isMesh || normals.length === 0) {
    return;
  }
  const packed = new Int16Array(normals.length);
  if (!packUnitNormals(normals, packed, 0)) {
    return;
  }
  data.normalsArray = packed;
}

/**
 * Write `source` into `out` at `offset` as snorm16; false (leaving `out`
 * partly written) as soon as a value is not a unit-range component.
 */
export function packUnitNormals(source: Float32Array, out: Int16Array, offset: number): boolean {
  // Kept to a single plain branch in the common case - measured in Chromium
  // on 24M values, this is ~34 ms where clamping every value cost ~55-75 ms.
  // floor(x + 0.5) rather than Math.round: the same result for every float32
  // in range (checked exhaustively), and about 3x faster in V8 - 9M values
  // went from ~78 ms to ~25 ms, which was most of a 3M-point PLY's build.
  for (let i = 0; i < source.length; i++) {
    const value = source[i];
    if (value >= -1 && value <= 1) {
      out[offset + i] = Math.floor(value * SNORM16 + 0.5);
      continue;
    }
    // A hair past 1 is float rounding in a normalized vector; anything more
    // is a non-unit normal. NaN fails both comparisons.
    if (!(value >= -1.0001 && value <= 1.0001)) {
      return false;
    }
    out[offset + i] = value > 0 ? SNORM16 : -SNORM16;
  }
  return true;
}

/** Normals as floats, whichever way they are stored (a view when already Float32). */
export function normalsAsFloat32(normals: NormalArray): Float32Array {
  if (normals instanceof Float32Array) {
    return normals;
  }
  const out = new Float32Array(normals.length);
  for (let i = 0; i < normals.length; i++) {
    out[i] = Math.max(-1, normals[i] / SNORM16);
  }
  return out;
}
