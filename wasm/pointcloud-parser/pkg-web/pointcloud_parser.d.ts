/* tslint:disable */
/* eslint-disable */

export class LidarCollectionResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_scan(index: number): LidarScanResult;
    readonly scan_count: number;
}

/**
 * A single decoded LAS/LAZ cloud or E57 scan. Buffers are moved to JS with
 * `take_*`, avoiding an additional Rust-side clone at the WASM boundary.
 */
export class LidarScanResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    bbox(): Float32Array;
    source_origin(): Float64Array;
    take_classification(): Float32Array;
    take_colors(): Uint8Array;
    take_column_index(): Float32Array;
    take_gps_time(): Float32Array;
    take_intensity(): Float32Array;
    take_number_of_returns(): Float32Array;
    take_point_source_id(): Float32Array;
    take_positions(): Float32Array;
    take_return_number(): Float32Array;
    take_row_index(): Float32Array;
    take_scan_angle(): Float32Array;
    take_user_data(): Float32Array;
    readonly has_colors: boolean;
    readonly metadata_json: string;
    readonly name: string;
    readonly source_count: number;
    readonly vertex_count: number;
}

/**
 * Parsed point cloud, returned to JS. Large buffers are moved out with the
 * `take_*` methods (no clone) the way wasm-bindgen marshals `Vec<T>`.
 */
export class PointCloudResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * [min_x, min_y, min_z, max_x, max_y, max_z]
     */
    bbox(): Float32Array;
    take_colors(): Uint8Array;
    take_intensity(): Float32Array;
    take_normals(): Float32Array;
    take_positions(): Float32Array;
    readonly has_colors: boolean;
    readonly has_intensity: boolean;
    readonly has_normals: boolean;
    readonly vertex_count: number;
}

/**
 * Incremental parser for streaming/overlapped loading. JS reads the file in
 * chunks and calls `push` on each (while the next chunk's read is in flight),
 * then `finish`. Partial lines are stitched across chunk boundaries via carry.
 */
export class StreamParser {
    free(): void;
    [Symbol.dispose](): void;
    finish(): PointCloudResult;
    constructor(format: string, color_mode: string);
    push(chunk: Uint8Array): void;
    /**
     * True if a parse error occurred; the caller should discard and use the JS
     * parser (the result from `finish` would be empty/partial).
     */
    readonly failed: boolean;
}

/**
 * Reserve `len` bytes in WASM memory and return the offset. Caller fills it,
 * passes it to `parse_at`, then releases it with `dealloc`.
 */
export function alloc(len: number): number;

/**
 * Free a buffer previously returned by `alloc`.
 */
export function dealloc(ptr: number, len: number): void;

/**
 * Parse an ASCII PLY: read the header to learn the vertex count + property
 * order, then parse the vertex rows. Falls back to an error string the JS side
 * can catch (and use its own parser) on anything unexpected.
 */
export function parse_ascii_ply(data: Uint8Array): PointCloudResult;

/**
 * Parse a buffer already sitting in WASM memory at `ptr`/`len`.
 */
export function parse_at(ptr: number, len: number, format: string): PointCloudResult;

export function parse_e57(data: Uint8Array, file_name: string): LidarCollectionResult;

export function parse_las(data: Uint8Array, file_name: string): LidarCollectionResult;

/**
 * Parse an ASCII PCD point cloud. Reads the FIELDS/COUNT header to build a
 * column layout (including PCD's packed-float `rgb`), then parses the rows.
 * Returns an error (→ JS fallback) for binary PCD or anything unsupported.
 */
export function parse_pcd_ascii(data: Uint8Array): PointCloudResult;

/**
 * Parse a binary PCD point cloud (`DATA binary`; not `binary_compressed`). Reads
 * the FIELDS/SIZE/TYPE/COUNT header to map each field to a byte offset + reader,
 * then walks fixed-size records straight into the packed output arrays — no
 * text parsing, so it's orders of magnitude faster than the JS binary path.
 * Returns Err (→ JS fallback) for ascii/compressed PCD, missing x/y/z, or a
 * header whose SIZE/TYPE don't line up with FIELDS.
 */
export function parse_pcd_binary(data: Uint8Array): PointCloudResult;

/**
 * Parse a PTS point cloud. PTS has an optional leading count line + comments
 * (both have < 3 numeric columns, so `parse_rows` skips them automatically),
 * then rows auto-detected from the first data row:
 *   3 → x y z · 4 → x y z intensity · 6 → x y z r g b ·
 *   7 → x y z intensity r g b (Open3D default).
 * Colors are 0-255 integers (the shared 0-1-vs-int heuristic in `Builder`
 * handles the common case; a rare all-channels-≤1 row could be misread — see
 * PERFORMANCE_PLAN raw-int colors note).
 */
export function parse_pts(data: Uint8Array): PointCloudResult;

/**
 * Parse XYZ / XYZN / XYZRGB. For plain "xyz" the layout is auto-detected from
 * the first valid row (3 = xyz, 4 = xyz+intensity, 6 = xyz+rgb).
 */
export function parse_xyz(data: Uint8Array, variant: string, color_mode: string): PointCloudResult;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_lidarcollectionresult_free: (a: number, b: number) => void;
    readonly __wbg_lidarscanresult_free: (a: number, b: number) => void;
    readonly __wbg_pointcloudresult_free: (a: number, b: number) => void;
    readonly __wbg_streamparser_free: (a: number, b: number) => void;
    readonly lidarcollectionresult_scan_count: (a: number) => number;
    readonly lidarcollectionresult_take_scan: (a: number, b: number) => [number, number, number];
    readonly lidarscanresult_bbox: (a: number) => [number, number];
    readonly lidarscanresult_has_colors: (a: number) => number;
    readonly lidarscanresult_metadata_json: (a: number) => [number, number];
    readonly lidarscanresult_name: (a: number) => [number, number];
    readonly lidarscanresult_source_count: (a: number) => number;
    readonly lidarscanresult_source_origin: (a: number) => [number, number];
    readonly lidarscanresult_take_classification: (a: number) => [number, number];
    readonly lidarscanresult_take_colors: (a: number) => [number, number];
    readonly lidarscanresult_take_column_index: (a: number) => [number, number];
    readonly lidarscanresult_take_gps_time: (a: number) => [number, number];
    readonly lidarscanresult_take_intensity: (a: number) => [number, number];
    readonly lidarscanresult_take_number_of_returns: (a: number) => [number, number];
    readonly lidarscanresult_take_point_source_id: (a: number) => [number, number];
    readonly lidarscanresult_take_positions: (a: number) => [number, number];
    readonly lidarscanresult_take_return_number: (a: number) => [number, number];
    readonly lidarscanresult_take_row_index: (a: number) => [number, number];
    readonly lidarscanresult_take_scan_angle: (a: number) => [number, number];
    readonly lidarscanresult_take_user_data: (a: number) => [number, number];
    readonly lidarscanresult_vertex_count: (a: number) => number;
    readonly parse_ascii_ply: (a: number, b: number) => [number, number, number];
    readonly parse_at: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_e57: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_las: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_pcd_ascii: (a: number, b: number) => [number, number, number];
    readonly parse_pcd_binary: (a: number, b: number) => [number, number, number];
    readonly parse_pts: (a: number, b: number) => number;
    readonly parse_xyz: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly pointcloudresult_bbox: (a: number) => [number, number];
    readonly pointcloudresult_has_colors: (a: number) => number;
    readonly pointcloudresult_has_intensity: (a: number) => number;
    readonly pointcloudresult_has_normals: (a: number) => number;
    readonly pointcloudresult_take_colors: (a: number) => [number, number];
    readonly pointcloudresult_take_intensity: (a: number) => [number, number];
    readonly pointcloudresult_take_normals: (a: number) => [number, number];
    readonly pointcloudresult_take_positions: (a: number) => [number, number];
    readonly pointcloudresult_vertex_count: (a: number) => number;
    readonly streamparser_failed: (a: number) => number;
    readonly streamparser_finish: (a: number) => number;
    readonly streamparser_new: (a: number, b: number, c: number, d: number) => number;
    readonly streamparser_push: (a: number, b: number, c: number) => void;
    readonly alloc: (a: number) => number;
    readonly dealloc: (a: number, b: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
