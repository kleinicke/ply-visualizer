import * as path from 'path';

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
      typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
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

/** Parse XYZ/XYZN/XYZRGB. Returns null if WASM is unavailable or parsing fails. */
export function parseXyzWasm(bytes: Uint8Array, variant: string): WasmPointCloud | null {
  const m = load();
  if (!m) {
    return null;
  }
  try {
    return marshal(m.parse_xyz(bytes, variant));
  } catch (error) {
    console.warn('[pointcloud-wasm] parse_xyz failed, falling back:', error);
    return null;
  }
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
