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

/**
 * A triangle mesh, ready for a `BufferGeometry`.
 */
export class IsosurfaceMesh {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_gradient_magnitudes(): Float32Array;
    take_indices(): Uint32Array;
    take_normals(): Float32Array;
    take_positions(): Float32Array;
    /**
     * The decimation actually used, so callers can report what they rendered.
     */
    readonly step: Uint32Array;
    readonly triangle_count: number;
    readonly vertex_count: number;
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
 * One array, decoded to f32.
 */
export class NpyArrayResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_values(): Float32Array;
    /**
     * The NumPy descr string, e.g. `<f4`.
     */
    readonly dtype: string;
    /**
     * Empty for a plain `.npy`; the archive key for a member of an `.npz`.
     */
    readonly name: string;
    readonly shape: Uint32Array;
}

/**
 * A decoded volume, handed to JS as f32 samples plus its header facts.
 */
export class NrrdVolume {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_samples(): Float32Array;
    readonly channels: number;
    readonly ijk_to_world: Float64Array;
    /**
     * Header facts as JSON: every field, plus the units and range the viewer
     * reads back out of them.
     */
    readonly metadata_json: string;
    readonly sizes: Uint32Array;
}

/**
 * Parsed PLY, handed to JS. Large buffers move out with the `take_*` methods.
 */
export class PlyResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * [min_x, min_y, min_z, max_x, max_y, max_z]
     */
    bbox(): Float32Array;
    take_colors(): Uint8Array;
    take_face_indices(): Uint32Array;
    /**
     * Vertices per face, parallel to the runs in `take_face_indices`.
     */
    take_face_sizes(): Uint32Array;
    take_intensity(): Float32Array;
    take_normals(): Float32Array;
    take_positions(): Float32Array;
    take_scalar_at(index: number): Float32Array;
    readonly face_count: number;
    readonly has_colors: boolean;
    readonly has_intensity: boolean;
    readonly has_normals: boolean;
    readonly is_gaussian_splat: boolean;
    /**
     * Header facts as JSON: format, version and comments.
     */
    readonly metadata_json: string;
    /**
     * Scalar-field names, in the order `take_scalar_at` expects.
     */
    readonly scalar_field_names: string[];
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
    readonly metadata_json: string;
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
    readonly candidate_total: number;
    readonly coloured_points: number;
    readonly pixels_in_frame: number;
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
     * Builds the camera-panel thumbnail from the same decoded image used for
     * point colouring. Keeping this here avoids demosaicing every frame again
     * in JavaScript after the colour-pass timer has stopped.
     */
    frame_preview(frame_index: number, preview_scale: number): StonexPreview;
    /**
     * `pixels` holds every frame's raw plane; each descriptor points into it.
     * Takes `pixels` by value: a `&[u8]` is copied into wasm memory for the
     * call and then copied again to retain it, which is 300 MB of duplication
     * on a large archive. Owning it costs one copy instead of two, and the
     * caller can drop its own reference immediately afterwards.
     */
    constructor(pixels: Uint8Array, frames_json: string);
}

export class StonexPreview {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_rgba(): Uint8Array;
    readonly height: number;
    readonly width: number;
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
 * Colours an archive's scans from every station's cameras, one scan at a time.
 *
 * Built once per pass and kept alive across scans, for the same reason the
 * parser's own colour session is: the point cloud, the raw planes and each
 * demosaiced panorama are shared by every scan, and the per-station depth
 * buffers cost a full pass over that station's points to build. Colouring
 * scan by scan rather than in one call is what lets the host publish a
 * finished scan while the rest are still running.
 */
export class StonexStationSession {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Colours one scan from every station's cameras.
     *
     * Returns true when it wrote anything, so the host can publish only the
     * scans that actually changed.
     */
    colour_scan(scan_index: number): boolean;
    /**
     * Takes the point cloud, the raw planes and the colour arrays by value.
     *
     * A `&[f32]` argument is copied into wasm memory for the call and would
     * have to be copied again to retain it; owning them costs one copy of the
     * archive instead of two, and the host keeps its own arrays untouched
     * until it reads the results back at the end.
     */
    constructor(positions: Float32Array, pixels: Uint8Array, raw_colours: Uint8Array, frame_indices: Uint16Array, coloured: Uint8Array, frames_json: string, scans_json: string, options_json: string);
    /**
     * This scan's colours, for publishing it before the rest are done.
     */
    scan_colours(scan_index: number): Uint8Array;
    scan_frame_indices(scan_index: number): Uint16Array;
    /**
     * One flag per point, set where this pass wrote.
     */
    take_changed(): Uint8Array;
    take_coloured(): Uint8Array;
    take_colours(): Uint8Array;
    take_frame_indices(): Uint16Array;
    /**
     * Points that gained colour they did not have before.
     */
    readonly newly_colored: number;
    /**
     * Point-station pairs rejected because that station could not see the
     * point. Counted per attempt: one point hidden from three stations
     * contributes three.
     */
    readonly occluded_samples: number;
    /**
     * Points whose colour was replaced by a better view.
     */
    readonly recolored: number;
    readonly scan_count: number;
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
 * A voxel-shell mesh, ready for a `BufferGeometry`.
 */
export class VoxelMesh {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    take_colors(): Uint8Array;
    take_indices(): Uint32Array;
    take_intensity(): Float32Array;
    take_positions(): Float32Array;
    readonly face_count: number;
    /**
     * The decimation actually used: the stride grows until the build fits the
     * face budget, and callers report what they rendered.
     */
    readonly step: Uint32Array;
    readonly vertex_count: number;
    /**
     * Voxels at or above the threshold, whether or not they showed a face.
     * Reported to the user as what the render mode actually kept.
     */
    readonly voxel_count: number;
    /**
     * World-space edge lengths of one emitted box, along i/j/k.
     */
    readonly voxel_size: Float32Array;
}

/**
 * Reserve `len` bytes in WASM memory and return the offset. Caller fills it,
 * passes it to `parse_at`, then releases it with `dealloc`.
 */
export function alloc(len: number): number;

/**
 * Build the exposed shell of every retained voxel.
 *
 * `clip` is six inclusive bounds (i0,i1,j0,j1,k0,k1); the stride grows from
 * `step` until the face count fits `max_faces`, because a low threshold on a
 * large volume would otherwise allocate hundreds of megabytes of geometry.
 */
export function build_volume_voxels(samples: Float32Array, sizes: Uint32Array, ijk_to_world: Float64Array, threshold: number, step: Uint32Array, max_faces: number, clip: Uint32Array, brightness_mode: string, window_center: number, window_width: number, slice_ranges: Float64Array, volume_range: Float64Array, monochrome1: boolean): VoxelMesh;

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
 * Extract an isosurface at `threshold`.
 *
 * `sizes` is the volume's (nx, ny, nz); `ijk_to_world` is its row-major 4x4;
 * `step` is the per-axis decimation, which the caller has already chosen.
 */
export function extract_isosurface(samples: Float32Array, sizes: Uint32Array, ijk_to_world: Float64Array, threshold: number, step: Uint32Array, max_triangles: number): IsosurfaceMesh;

/**
 * Closed-form fit from matched correspondences.
 */
export function fit_correspondences(source: Float32Array, target: Float32Array): RegistrationResult | undefined;

/**
 * ICP refinement alone, from `settings.initial` (identity when absent).
 */
export function icp_refine(source: Float32Array, target: Float32Array, settings_json: string): RegistrationResult | undefined;

/**
 * What a `.npy` or `.npz` holds, without decoding any of it: a JSON array of
 * `{name, shape, dtype}`. Callers use it to decide whether a file is a point
 * cloud or a depth image, and which member of an archive to ask for.
 */
export function npy_inspect(data: Uint8Array): string;

/**
 * Decode one array to f32. `name` selects an archive member; it is ignored for
 * a plain `.npy`, and an empty name takes the archive's first array.
 */
export function npy_read(data: Uint8Array, name: string): NpyArrayResult;

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
 * Parse a NRRD volume. `payload` supplies a detached data file when the header
 * names one; pass an empty slice otherwise.
 */
export function parse_nrrd(data: Uint8Array, detached: Uint8Array): NrrdVolume;

/**
 * Parse a PCD point cloud in any of its three encodings.
 *
 * One entry point rather than one per encoding: the caller cannot know which
 * it has without reading the header, and the header is read here.
 */
export function parse_pcd(data: Uint8Array): PointCloudResult;

/**
 * Parse a PLY file in either encoding, with faces, scalar fields and 3DGS
 * colour synthesis.
 */
export function parse_ply(data: Uint8Array): PlyResult;

/**
 * Parse a PLY already sitting in wasm memory at `ptr`/`len`.
 *
 * The `&[u8]` entry point above makes wasm-bindgen copy the whole file across
 * the boundary first, which on a 200 MB point cloud costs more than the parse.
 * The caller can instead `alloc` a buffer, stream the file straight into it,
 * and parse it where it lies.
 *
 * # Safety
 * `ptr`/`len` must describe a buffer returned by `alloc` and still live.
 */
export function parse_ply_at(ptr: number, len: number): PlyResult;

/**
 * Parse a PTS point cloud. PTS has an optional leading count line + comments
 * (both have < 3 numeric columns, so `parse_rows` skips them automatically),
 * then rows auto-detected from the first data row:
 *   3 → x y z · 4 → x y z intensity · 6 → x y z r g b ·
 *   7 → x y z intensity r g b (Open3D default) ·
 *   9 → x y z r g b nx ny nz.
 * PTS colors are always 0-255 integers, so `ColorMode::Byte` is forced rather
 * than left to the value heuristic — otherwise a dark row like `1 1 1` would
 * be read as 0..1 floats and turn white.
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

/**
 * Decodes a scan whose layout was already validated and counted by the archive
 * parser. Avoids scanning every range a second time merely to rediscover the
 * same valid-point count before decoding it.
 */
export function stonex_decode_scan_known_layout(record: Uint8Array, columns: number, rows: number, column_offset: number, column_stride: number, valid_points: number): StonexScanPoints;
