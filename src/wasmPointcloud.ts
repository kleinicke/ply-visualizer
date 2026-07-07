import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';

/**
 * Thin loader/wrapper around the Rust/WASM point-cloud parser
 * (wasm/pointcloud-parser, built with `wasm-pack --target nodejs`).
 *
 * The compiled pkg is copied to out/wasm/pointcloud-parser/ at build time and
 * loaded here with a runtime require (via __non_webpack_require__ so webpack
 * leaves it alone). Everything is best-effort: if the module can't load or a
 * parse throws, the callers fall back to the existing JS parsers — same
 * behavior as before, just without the speedup.
 */

// webpack replaces require() of static paths; this keeps the require at runtime.
// eslint-disable-next-line @typescript-eslint/naming-convention -- name is defined by webpack
declare const __non_webpack_require__: NodeRequire | undefined;

export interface WasmPointCloud {
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
}

let mod: any = null;
let attempted = false;

function load(): any {
  if (attempted) {
    return mod;
  }
  attempted = true;
  try {
    const req: NodeRequire =
      typeof __non_webpack_require__ !== 'undefined'
        ? __non_webpack_require__
        : createRequire(__filename);
    mod = req(path.join(__dirname, 'wasm', 'pointcloud-parser', 'pointcloud_parser.js'));
  } catch (error) {
    console.warn('[pointcloud-wasm] module unavailable, using JS parsers:', error);
    mod = null;
  }
  return mod;
}

function marshal(r: any): WasmPointCloud {
  const out: WasmPointCloud = {
    vertexCount: r.vertex_count,
    hasColors: r.has_colors,
    hasNormals: r.has_normals,
    hasIntensity: r.has_intensity,
    positionsArray: r.take_positions(),
    colorsArray: r.has_colors ? r.take_colors() : null,
    normalsArray: r.has_normals ? r.take_normals() : null,
    intensityArray: r.has_intensity ? r.take_intensity() : null,
    bbox: r.bbox(),
  };
  if (typeof r.free === 'function') {
    r.free();
  }
  return out;
}

/**
 * Parse XYZ/XYZN/XYZRGB. `colorMode` ('auto' | 'byte' | 'unit') is only used for
 * colored variants: XYZ formats carry no type info, so the caller decides whether
 * colors are 0-255 ints or 0-1 floats by checking the color tokens' text (see
 * detectXyzColorMode) and passes 'byte'/'unit'. 'auto' keeps the value heuristic.
 * Returns null if WASM is unavailable or parsing fails.
 */
export function parseXyzWasm(
  bytes: Uint8Array,
  variant: string,
  colorMode: string = 'auto'
): WasmPointCloud | null {
  const m = load();
  if (!m) {
    return null;
  }
  try {
    return marshal(m.parse_xyz(bytes, variant, colorMode));
  } catch (error) {
    console.warn('[pointcloud-wasm] parse_xyz failed, falling back:', error);
    return null;
  }
}

/**
 * Decide whether a colored XYZ file's colors are written as ints (`4`) or floats
 * (`0.0156`, `1.0`) by scanning a text sample. ONE decision per file (writers are
 * consistent), and only the COLOR columns (index ≥ 3) are checked — positions
 * always have decimals. Returns 'unit' (float, scale ×255), 'byte' (int 0-255),
 * or 'auto' if there are no color columns / nothing decisive.
 */
export function detectXyzColorMode(sample: Uint8Array, variant: string): string {
  // Only the 6-column colored variant has separate r/g/b at indices 3-5.
  if (variant !== 'xyzrgb') {
    return 'auto';
  }
  const text = Buffer.from(sample).toString('latin1');
  const lines = text.split('\n');
  // Drop the last (possibly truncated) line from the sample.
  for (let li = 0; li < lines.length - 1; li++) {
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
        return 'unit'; // a color written with a decimal/exponent → float file
      }
    }
  }
  return 'byte';
}

/** Parse an ASCII PLY point cloud. Returns null on failure (caller falls back). */
export function parseAsciiPlyWasm(bytes: Uint8Array): WasmPointCloud | null {
  const m = load();
  if (!m) {
    return null;
  }
  try {
    return marshal(m.parse_ascii_ply(bytes));
  } catch (error) {
    console.warn('[pointcloud-wasm] parse_ascii_ply failed, falling back:', error);
    return null;
  }
}

/**
 * Stream-load a local ASCII point-cloud file with overlapped read+parse: the
 * next chunk's disk read (on libuv's threadpool) runs while the current chunk
 * is parsed on the main thread, so total load ≈ max(read, parse) instead of
 * read + parse. `format` is "xyz" | "xyzn" | "xyzrgb" | "ply" | "pcd".
 * Returns null if WASM/StreamParser is unavailable, the format is rejected
 * (mesh PLY, binary PCD, …), or anything throws — caller falls back.
 */
export async function streamParseFile(
  filePath: string,
  format: string,
  colorMode: string = 'auto'
): Promise<WasmPointCloud | null> {
  const m = load();
  if (!m || typeof m.StreamParser !== 'function') {
    return null;
  }
  let fh: fs.promises.FileHandle | undefined;
  try {
    const sp = new m.StreamParser(format, colorMode);
    fh = await fs.promises.open(filePath, 'r');
    const CHUNK = 8 * 1024 * 1024;
    const bufs = [Buffer.allocUnsafe(CHUNK), Buffer.allocUnsafe(CHUNK)];
    let idx = 0;
    let readP = fh.read(bufs[idx], 0, CHUNK, null);
    for (;;) {
      const { bytesRead } = await readP;
      if (bytesRead === 0) {
        break;
      }
      const cur = bufs[idx];
      idx ^= 1;
      // Kick off the next read (libuv I/O) BEFORE parsing this chunk (main
      // thread) so the two overlap.
      readP = fh.read(bufs[idx], 0, CHUNK, null);
      sp.push(cur.subarray(0, bytesRead));
      if (sp.failed) {
        return null; // header rejected → JS fallback
      }
    }
    if (sp.failed) {
      return null;
    }
    return marshal(sp.finish());
  } catch (error) {
    console.warn('[pointcloud-wasm] stream parse failed, falling back:', error);
    return null;
  } finally {
    if (fh) {
      await fh.close();
    }
  }
}

/** Parse an ASCII PCD point cloud. Returns null on failure (caller falls back). */
export function parsePcdAsciiWasm(bytes: Uint8Array): WasmPointCloud | null {
  const m = load();
  if (!m) {
    return null;
  }
  try {
    return marshal(m.parse_pcd_ascii(bytes));
  } catch (error) {
    console.warn('[pointcloud-wasm] parse_pcd_ascii failed, falling back:', error);
    return null;
  }
}

/** Parse a binary (DATA binary) PCD point cloud. Returns null on failure. */
export function parsePcdBinaryWasm(bytes: Uint8Array): WasmPointCloud | null {
  const m = load();
  if (!m || typeof m.parse_pcd_binary !== 'function') {
    return null;
  }
  try {
    return marshal(m.parse_pcd_binary(bytes));
  } catch (error) {
    console.warn('[pointcloud-wasm] parse_pcd_binary failed, falling back:', error);
    return null;
  }
}

/** Parse a PTS point cloud. Returns null on failure (caller falls back). */
export function parsePtsWasm(bytes: Uint8Array): WasmPointCloud | null {
  const m = load();
  if (!m || typeof m.parse_pts !== 'function') {
    return null;
  }
  try {
    return marshal(m.parse_pts(bytes));
  } catch (error) {
    console.warn('[pointcloud-wasm] parse_pts failed, falling back:', error);
    return null;
  }
}
