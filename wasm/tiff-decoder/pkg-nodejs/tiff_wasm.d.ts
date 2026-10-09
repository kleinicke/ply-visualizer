/* tslint:disable */
/* eslint-disable */
/**
 * Project selected 3D points after applying a row-major 4x4 transform.
 *
 * `positions` contains interleaved xyz values and `indices` selects the
 * points to project. The result contains interleaved uv values in index order;
 * rejected points are returned as NaN pairs. `max_normalized_x/y` provide an
 * optional pre-distortion calibration-domain guard (use infinity to disable).
 */
export function camera_project_points_indexed(camera_model: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array, positions: Float32Array, indices: Uint32Array, transform: Float64Array, max_normalized_x: number, max_normalized_y: number): Float32Array;
/**
 * Unproject one pixel to a unit OpenCV-coordinate ray. Returns
 * `[valid, converged, iterations, x, y, z]`.
 */
export function camera_unproject(camera_model: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array, u: number, v: number): Float64Array;
export function project_depth_fast(data: Float32Array, width: number, height: number, kind: string, camera_model: string, convention: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array): DepthProjectResult;
export function normalize_depth_fast(data: Float32Array, width: number, height: number, kind: string, unit: string, scale: number, depth_scale: number, depth_bias: number, fx: number, baseline: number, disparity_offset: number, has_clamp_min: boolean, clamp_min: number, has_clamp_max: boolean, clamp_max: number): NormalizeDepthResult;
/**
 * Project one OpenCV-coordinate ray. Returns
 * `[valid, converged, iterations, u, v]`.
 */
export function camera_project(camera_model: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array, x: number, y: number, z: number): Float64Array;
export function project_depth_inspection(data: Float32Array, width: number, height: number, kind: string, camera_model: string, convention: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array): DepthProjectResult;
/**
 * One horizontal band of an image, projected with the *whole* image's depth
 * range and row offset.
 *
 * Splitting the unprojection across workers is only sound if every band agrees
 * on two things it cannot see from its own rows: the grey ramp's endpoints
 * (which are logarithmic over the full depth range, so a per-band range shows
 * up as banding), and where the band sits in the image (`row_offset`, which
 * the returned pixel coordinates need — the intrinsics are pre-shifted by the
 * caller so the rays themselves are already correct).
 *
 * `depth_min`/`depth_max` come from one pass over the full image; pass
 * non-finite values to fall back to this band's own range.
 */
export function project_depth_band(data: Float32Array, width: number, height: number, row_offset: number, depth_min: number, depth_max: number, kind: string, camera_model: string, convention: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array): DepthProjectResult;
export function decode_colmap_depth(bytes: Uint8Array): Float32Array;
/**
 * PFM raw samples in top-left raster order; caller explicitly supplies value scale.
 */
export function decode_depth_pfm(bytes: Uint8Array): DepthRaster;
export function decode_tiff_page_fast(data: Uint8Array, page_index: number): TiffResult;
/**
 * # Errors
 *
 * A malformed EXR header.
 */
export function exr_zip_plan(data: Uint8Array): ExrZipPlanJs | undefined;
export function decode_tiff(data: Uint8Array): TiffResult;
export function decode_png_samples_fast(data: Uint8Array): PngResult;
export function tiff_strip_plan(data: Uint8Array): TiffStripPlan | undefined;
export function extract_exif_tags(data: Uint8Array): string;
/**
 * Decode strips `first_strip..first_strip + counts.len()` from their
 * concatenated compressed bytes, as the f32 samples `decode_tiff_fast`
 * produces for those rows. `fields` comes from `TiffStripPlan::fields`.
 */
export function decode_tiff_strip_range(blob: Uint8Array, counts: Uint32Array, first_strip: number, fields: Float64Array): Float32Array;
export function decode_tiff_page(data: Uint8Array, page_index: number): TiffResult;
export function decode_exr_fast(data: Uint8Array): ExrResult;
export function tiff_page_count(data: Uint8Array): number;
export function decode_png16_fast(data: Uint8Array): PngResult;
export function decode_tiff_fast(data: Uint8Array): TiffResult;
/**
 * Blocks `counts` (with `rows` scanlines each) of a ZIP16 EXR, as the
 * interleaved displayed channels `decode_exr_fast` returns for those rows.
 *
 * # Errors
 *
 * Malformed or truncated blocks, or a selection outside the channels.
 */
export function decode_exr_zip_blocks(blob: Uint8Array, counts: Uint32Array, rows: Uint32Array, width: number, kinds: Uint32Array, selection: Int32Array): Float32Array;
/**
 * One band's depth rows, kept in wasm memory between projections.
 *
 * A depth-parameter change re-projects the same decoded image with new
 * intrinsics. `project_depth_band` takes the rows as an argument, so every
 * change copied each band out of the image, across to its worker and into
 * wasm again - 100 MB per change on a 26-megapixel image. A session holds its
 * rows once; later projections send only the parameters. Wasm memory never
 * shrinks, so keeping them resident costs nothing the last copy had not
 * already claimed.
 */
export class DepthBandSession {
  free(): void;
  [Symbol.dispose](): void;
  constructor(data: Float32Array, width: number, height: number, row_offset: number);
  /**
   * `project_depth_band` over the session's rows.
   *
   * # Errors
   *
   * As `project_depth_band`: an unknown camera model or mismatched rows.
   */
  project(depth_min: number, depth_max: number, kind: string, camera_model: string, convention: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array): DepthProjectResult;
}
export class DepthProjectResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  take_colors(): Uint8Array;
  take_positions(): Float32Array;
  take_pixel_coords(): Uint16Array;
  take_source_indices(): Uint32Array;
  readonly point_count: number;
  readonly rejected_count: number;
  readonly has_pixel_coords: boolean;
  readonly non_converged_count: number;
  readonly width: number;
  readonly height: number;
}
export class DepthRaster {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  take_data(): Float32Array;
  width: number;
  height: number;
  channels: number;
}
export class ExrResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  take_data_as_f32(): Float32Array;
  readonly all_tags_json: string;
  readonly timing_pack_ms: number;
  readonly timing_read_ms: number;
  readonly timing_total_ms: number;
  readonly channel_names_csv: string;
  readonly displayed_channels_csv: string;
  readonly width: number;
  readonly format: number;
  readonly height: number;
  readonly channels: number;
  readonly data_max: number;
  readonly data_min: number;
  readonly data_type: number;
}
/**
 * A ZIP16 scanline EXR's compressed blocks and channel layout, for decoding
 * it in row ranges on several workers (`decode_exr_zip_blocks`). Ported from
 * the image viewer's adapter; undefined for every other EXR layout.
 */
export class ExrZipPlanJs {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Move the compressed blocks out, back to back in file order.
   */
  take_compressed(): Uint8Array;
  /**
   * Each channel's pixel type: 0 u32, 1 half, 2 float.
   */
  readonly channel_kinds: Uint32Array;
  readonly y_coordinates: Int32Array;
  readonly displayed_names: string[];
  readonly width: number;
  readonly counts: Uint32Array;
  readonly data_y: number;
  readonly height: number;
  /**
   * The displayed channels as indices into the file's channels (-1: absent).
   */
  readonly selection: Int32Array;
}
export class NormalizeDepthResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  take_data(): Float32Array;
  readonly kind: string;
  readonly unit: string;
  readonly width: number;
  readonly height: number;
}
export class PngResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  take_data_as_u16(): Uint16Array;
  readonly color_type: number;
  readonly timing_total_ms: number;
  readonly timing_decode_ms: number;
  readonly timing_convert_ms: number;
  readonly timing_read_info_ms: number;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly bit_depth: number;
}
export class TiffResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  get_data_bytes(): Uint8Array;
  get_data_as_f32(): Float32Array;
  take_data_as_f32(): Float32Array;
  readonly tile_count: number;
  readonly tile_width: number;
  readonly compression: number;
  readonly strip_count: number;
  readonly tile_length: number;
  readonly all_tags_json: string;
  readonly direct_decode: boolean;
  readonly sample_format: number;
  readonly rows_per_strip: number;
  readonly timing_pack_ms: number;
  readonly bits_per_sample: number;
  readonly timing_stats_ms: number;
  readonly timing_decode_ms: number;
  readonly timing_convert_ms: number;
  readonly timing_metadata_ms: number;
  readonly planar_configuration: number;
  readonly strip_byte_count_max: number;
  readonly strip_byte_count_total: number;
  readonly photometric_interpretation: number;
  readonly width: number;
  readonly height: number;
  readonly ome_xml: string;
  readonly channels: number;
  readonly max_value: number;
  readonly min_value: number;
  readonly predictor: number;
}
/**
 * A stripped TIFF's block table and layout, for decoding it in row ranges on
 * several workers (`decode_tiff_strip_range`). Undefined for files the
 * range decoder does not cover; those take `decode_tiff_fast`.
 */
export class TiffStripPlan {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Compressed length of each strip.
   */
  counts(): Float64Array;
  /**
   * The layout as numbers, to rebuild the plan in another worker.
   */
  fields(): Float64Array;
  /**
   * Byte offset of each strip within the file.
   */
  offsets(): Float64Array;
  readonly compression: number;
  readonly sample_format: number;
  readonly rows_per_strip: number;
  readonly bits_per_sample: number;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly predictor: number;
  /**
   * True for a plain chunky, top-left, non-CMYK strip layout: the one shape
   * whose ranges simply stack into the image.
   */
  readonly stackable: boolean;
}
