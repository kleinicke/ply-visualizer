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
    take_scalar_at(index: number): Float32Array;
    readonly has_colors: boolean;
    readonly has_intensity: boolean;
    readonly has_normals: boolean;
    readonly metadata_json: string;
    readonly scalar_field_names: string[];
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
 * Smallest eigenvalue of a cloud's normalized normal-covariance, in [0, 1/3].
 *
 * A caller ordering a multi-cloud alignment uses this to tell which clouds can
 * be placed from a blind search and which have to wait for a neighbour: see
 * `position_conditioning`.
 */
export function cloud_position_conditioning(points: Float32Array, cell: number): number;

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
 * Bounded attribute discovery: continuous fields never produce huge tool replies.
 */
export function scalar_summary(values: Float32Array): string;

export function select_point_indices(positions: Float32Array, values: Float32Array, accepted: Float32Array, matrix: Float64Array, bounds: Float64Array, plane: Float64Array): Uint32Array;

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

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_e57imageresult_free: (a: number, b: number) => void;
    readonly __wbg_isosurfacemesh_free: (a: number, b: number) => void;
    readonly __wbg_lidarcollectionresult_free: (a: number, b: number) => void;
    readonly __wbg_lidarscanresult_free: (a: number, b: number) => void;
    readonly __wbg_npyarrayresult_free: (a: number, b: number) => void;
    readonly __wbg_nrrdvolume_free: (a: number, b: number) => void;
    readonly __wbg_plyresult_free: (a: number, b: number) => void;
    readonly __wbg_pointcloudresult_free: (a: number, b: number) => void;
    readonly __wbg_registrationresult_free: (a: number, b: number) => void;
    readonly __wbg_stonexcolourresult_free: (a: number, b: number) => void;
    readonly __wbg_stonexcoloursession_free: (a: number, b: number) => void;
    readonly __wbg_stonexpreview_free: (a: number, b: number) => void;
    readonly __wbg_stonexscanpoints_free: (a: number, b: number) => void;
    readonly __wbg_stonexstationsession_free: (a: number, b: number) => void;
    readonly __wbg_streamparser_free: (a: number, b: number) => void;
    readonly __wbg_voxelmesh_free: (a: number, b: number) => void;
    readonly build_volume_voxels: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number) => [number, number, number];
    readonly cloud_position_conditioning: (a: number, b: number, c: number) => number;
    readonly coarse_align: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly e57imageresult_metadata_json: (a: number) => [number, number];
    readonly e57imageresult_take_data: (a: number) => [number, number];
    readonly e57imageresult_take_mask: (a: number) => [number, number];
    readonly extract_isosurface: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number];
    readonly fit_correspondences: (a: number, b: number, c: number, d: number) => number;
    readonly icp_refine: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly isosurfacemesh_step: (a: number) => [number, number];
    readonly isosurfacemesh_take_gradient_magnitudes: (a: number) => [number, number];
    readonly isosurfacemesh_take_indices: (a: number) => [number, number];
    readonly isosurfacemesh_take_normals: (a: number) => [number, number];
    readonly isosurfacemesh_take_positions: (a: number) => [number, number];
    readonly isosurfacemesh_triangle_count: (a: number) => number;
    readonly isosurfacemesh_vertex_count: (a: number) => number;
    readonly lidarcollectionresult_errors_json: (a: number) => [number, number];
    readonly lidarcollectionresult_image_count: (a: number) => number;
    readonly lidarcollectionresult_scan_count: (a: number) => number;
    readonly lidarcollectionresult_take_image: (a: number, b: number) => [number, number, number];
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
    readonly npy_inspect: (a: number, b: number) => [number, number, number, number];
    readonly npy_read: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly npyarrayresult_dtype: (a: number) => [number, number];
    readonly npyarrayresult_name: (a: number) => [number, number];
    readonly npyarrayresult_shape: (a: number) => [number, number];
    readonly nrrdvolume_channels: (a: number) => number;
    readonly nrrdvolume_ijk_to_world: (a: number) => [number, number];
    readonly nrrdvolume_metadata_json: (a: number) => [number, number];
    readonly nrrdvolume_sizes: (a: number) => [number, number];
    readonly parse_ascii_ply: (a: number, b: number) => [number, number, number];
    readonly parse_at: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_e57: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_las: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_nrrd: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_pcd: (a: number, b: number) => [number, number, number];
    readonly parse_ply: (a: number, b: number) => [number, number, number];
    readonly parse_ply_at: (a: number, b: number) => [number, number, number];
    readonly parse_pts: (a: number, b: number) => number;
    readonly parse_xyz: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly plyresult_bbox: (a: number) => [number, number];
    readonly plyresult_face_count: (a: number) => number;
    readonly plyresult_has_colors: (a: number) => number;
    readonly plyresult_has_intensity: (a: number) => number;
    readonly plyresult_has_normals: (a: number) => number;
    readonly plyresult_is_gaussian_splat: (a: number) => number;
    readonly plyresult_metadata_json: (a: number) => [number, number];
    readonly plyresult_scalar_field_names: (a: number) => [number, number];
    readonly plyresult_take_face_sizes: (a: number) => [number, number];
    readonly plyresult_take_scalar_at: (a: number, b: number) => [number, number];
    readonly plyresult_vertex_count: (a: number) => number;
    readonly pointcloudresult_bbox: (a: number) => [number, number];
    readonly pointcloudresult_has_colors: (a: number) => number;
    readonly pointcloudresult_has_intensity: (a: number) => number;
    readonly pointcloudresult_has_normals: (a: number) => number;
    readonly pointcloudresult_metadata_json: (a: number) => [number, number];
    readonly pointcloudresult_scalar_field_names: (a: number) => [number, number];
    readonly pointcloudresult_take_scalar_at: (a: number, b: number) => [number, number];
    readonly pointcloudresult_vertex_count: (a: number) => number;
    readonly register_pair: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly registrationresult_matrix: (a: number) => [number, number];
    readonly registrationresult_stats: (a: number) => [number, number];
    readonly scalar_summary: (a: number, b: number) => [number, number];
    readonly select_point_indices: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
    readonly stonex_decode_frame: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly stonex_decode_scan: (a: number, b: number) => [number, number, number];
    readonly stonex_decode_scan_known_layout: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly stonexcolourresult_candidate_total: (a: number) => number;
    readonly stonexcolourresult_coloured_points: (a: number) => number;
    readonly stonexcolourresult_pixels_in_frame: (a: number) => number;
    readonly stonexcolourresult_take_colours: (a: number) => [number, number];
    readonly stonexcolourresult_take_frame_indices: (a: number) => [number, number];
    readonly stonexcoloursession_colour_scan: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly stonexcoloursession_frame_preview: (a: number, b: number, c: number) => number;
    readonly stonexcoloursession_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly stonexpreview_height: (a: number) => number;
    readonly stonexpreview_width: (a: number) => number;
    readonly stonexscanpoints_point_count: (a: number) => number;
    readonly stonexscanpoints_take_column_azimuths: (a: number) => [number, number];
    readonly stonexstationsession_colour_scan: (a: number, b: number) => number;
    readonly stonexstationsession_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number) => [number, number, number];
    readonly stonexstationsession_newly_colored: (a: number) => number;
    readonly stonexstationsession_occluded_samples: (a: number) => number;
    readonly stonexstationsession_scan_colours: (a: number, b: number) => [number, number];
    readonly stonexstationsession_scan_count: (a: number) => number;
    readonly stonexstationsession_scan_frame_indices: (a: number, b: number) => [number, number];
    readonly stonexstationsession_take_changed: (a: number) => [number, number];
    readonly stonexstationsession_take_coloured: (a: number) => [number, number];
    readonly stonexstationsession_take_colours: (a: number) => [number, number];
    readonly stonexstationsession_take_frame_indices: (a: number) => [number, number];
    readonly streamparser_failed: (a: number) => number;
    readonly streamparser_finish: (a: number) => number;
    readonly streamparser_new: (a: number, b: number, c: number, d: number) => number;
    readonly streamparser_push: (a: number, b: number, c: number) => void;
    readonly voxelmesh_face_count: (a: number) => number;
    readonly voxelmesh_step: (a: number) => [number, number];
    readonly voxelmesh_voxel_count: (a: number) => number;
    readonly voxelmesh_voxel_size: (a: number) => [number, number];
    readonly plyresult_take_colors: (a: number) => [number, number];
    readonly pointcloudresult_take_colors: (a: number) => [number, number];
    readonly stonexpreview_take_rgba: (a: number) => [number, number];
    readonly stonexrgbimage_take_data: (a: number) => [number, number];
    readonly voxelmesh_take_colors: (a: number) => [number, number];
    readonly alloc: (a: number) => number;
    readonly stonexrgbimage_height: (a: number) => number;
    readonly stonexrgbimage_width: (a: number) => number;
    readonly stonexstationsession_recolored: (a: number) => number;
    readonly voxelmesh_vertex_count: (a: number) => number;
    readonly __wbg_stonexrgbimage_free: (a: number, b: number) => void;
    readonly npyarrayresult_take_values: (a: number) => [number, number];
    readonly nrrdvolume_take_samples: (a: number) => [number, number];
    readonly plyresult_take_face_indices: (a: number) => [number, number];
    readonly plyresult_take_intensity: (a: number) => [number, number];
    readonly plyresult_take_normals: (a: number) => [number, number];
    readonly plyresult_take_positions: (a: number) => [number, number];
    readonly pointcloudresult_take_intensity: (a: number) => [number, number];
    readonly pointcloudresult_take_normals: (a: number) => [number, number];
    readonly pointcloudresult_take_positions: (a: number) => [number, number];
    readonly stonexscanpoints_take_intensity: (a: number) => [number, number];
    readonly stonexscanpoints_take_points_per_column: (a: number) => [number, number];
    readonly stonexscanpoints_take_positions: (a: number) => [number, number];
    readonly voxelmesh_take_indices: (a: number) => [number, number];
    readonly voxelmesh_take_intensity: (a: number) => [number, number];
    readonly voxelmesh_take_positions: (a: number) => [number, number];
    readonly dealloc: (a: number, b: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
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
