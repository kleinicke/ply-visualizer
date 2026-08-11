/* tslint:disable */
/* eslint-disable */

/**
 * An embedded E57 JPEG/PNG representation and its optional PNG validity mask.
 * Encoded bytes are kept encoded across the WASM boundary so callers can
 * decode one image at a time instead of retaining every full-resolution RGB
 * buffer.
 */
export class E57ImageResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_data(): Uint8Array;
    take_mask(): Uint8Array;
    readonly metadata_json: string;
}

export class LidarCollectionResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_image(index: number): E57ImageResult;
    take_scan(index: number): LidarScanResult;
    readonly errors_json: string;
    readonly image_count: number;
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
 * Column-major 4x4 pose plus a JSON stats blob, for every stage.
 */
export class RegistrationResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly matrix: Float64Array;
    readonly stats: string;
}

export class StonexColourResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_colours(): Uint8Array;
    take_frame_indices(): Uint16Array;
    readonly coloured_points: number;
}

/**
 * Holds an archive's frames for the length of a parse.
 *
 * The pixels and the decoded panoramas live here rather than in each call:
 * they are shared by every scan, and rebuilding them per scan meant a
 * six-scan archive demosaicing its ten frames sixty times and copying the
 * pixel buffer six times over. Created once, coloured scan by scan, dropped at
 * the end.
 */
export class StonexColourSession {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Colours one scan from the frames named in `active_frames`.
     *
     * Returned frame indices address this session's frame list, which is the
     * archive's own ordering, so no remapping is needed on the way out.
     */
    colour_scan(positions: Float32Array, column_azimuths: Float64Array, points_per_column: Uint32Array, active_frames: Uint32Array): StonexColourResult;
    /**
     * `pixels` holds every frame's raw plane; each descriptor points into it.
     * Takes `pixels` by value: a `&[u8]` is copied into wasm memory for the
     * call and then copied again to retain it, which is 300 MB of duplication
     * on a large archive. Owning it costs one copy instead of two, and the
     * caller can drop its own reference immediately afterwards.
     */
    constructor(pixels: Uint8Array, frames_json: string);
}

/**
 * Decoded frame for JS: interleaved RGB at `CAMERA_RGB_SCALE`.
 */
export class StonexRgbImage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_data(): Uint8Array;
    readonly height: number;
    readonly width: number;
}

/**
 * One decoded X3R record, for comparison against the TypeScript decoder.
 */
export class StonexScanPoints {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_column_azimuths(): Float64Array;
    take_intensity(): Float32Array;
    take_points_per_column(): Uint32Array;
    take_positions(): Float32Array;
    readonly point_count: number;
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
 * Coarse stage alone, for callers that want the shortlist without paying for
 * refinement.
 */
export function coarse_align(source: Float32Array, target: Float32Array, settings_json: string): RegistrationResult | undefined;

/**
 * Free a buffer previously returned by `alloc`.
 */
export function dealloc(ptr: number, len: number): void;

/**
 * Closed-form fit from matched correspondences.
 */
export function fit_correspondences(source: Float32Array, target: Float32Array): RegistrationResult | undefined;

/**
 * ICP refinement alone, from `settings.initial` (identity when absent).
 */
export function icp_refine(source: Float32Array, target: Float32Array, settings_json: string): RegistrationResult | undefined;

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

/**
 * Coarse sweep and/or ICP refinement, per `settings_json`.
 *
 * `source` and `target` are flat xyz triples in world space. Returns
 * `undefined` when nothing could be registered.
 */
export function register_pair(source: Float32Array, target: Float32Array, settings_json: string): RegistrationResult | undefined;

/**
 * Demosaics one X3I frame.
 *
 * `pixels` is the raw GRBG plane for this frame alone. Exposed while the port
 * is in progress so the TypeScript decode can be compared against this one on
 * real frames; the colour pass will call it internally rather than handing
 * images back across the boundary.
 */
export function stonex_decode_frame(pixels: Uint8Array, raw_width: number, raw_height: number, image_width: number, image_height: number): StonexRgbImage;

/**
 * Decodes one X3R record's points.
 *
 * `record` is the member's bytes on their own. Exposed while the port is in
 * progress so the TypeScript decoder can be checked against this one on the
 * real archives.
 */
export function stonex_decode_scan(record: Uint8Array): StonexScanPoints;
