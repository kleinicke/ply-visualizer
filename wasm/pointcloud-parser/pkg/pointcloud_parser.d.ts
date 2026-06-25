/* tslint:disable */
/* eslint-disable */

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
    constructor(format: string);
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
export function parse_xyz(data: Uint8Array, variant: string): PointCloudResult;
