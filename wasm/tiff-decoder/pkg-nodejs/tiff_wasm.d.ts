/* tslint:disable */
/* eslint-disable */
/**
 * Project one OpenCV-coordinate ray. Returns
 * `[valid, converged, iterations, u, v]`.
 */
export function camera_project(camera_model: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array, x: number, y: number, z: number): Float64Array;
export function normalize_depth_fast(data: Float32Array, width: number, height: number, kind: string, unit: string, scale: number, depth_scale: number, depth_bias: number, fx: number, baseline: number, disparity_offset: number, has_clamp_min: boolean, clamp_min: number, has_clamp_max: boolean, clamp_max: number): NormalizeDepthResult;
/**
 * Project selected 3D points after applying a row-major 4x4 transform.
 *
 * `positions` contains interleaved xyz values and `indices` selects the
 * points to project. The result contains interleaved uv values in index order;
 * rejected points are returned as NaN pairs. `max_normalized_x/y` provide an
 * optional pre-distortion calibration-domain guard (use infinity to disable).
 */
export function camera_project_points_indexed(camera_model: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array, positions: Float32Array, indices: Uint32Array, transform: Float64Array, max_normalized_x: number, max_normalized_y: number): Float32Array;
export function project_depth_inspection(data: Float32Array, width: number, height: number, kind: string, camera_model: string, convention: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array): DepthProjectResult;
export function project_depth_fast(data: Float32Array, width: number, height: number, kind: string, camera_model: string, convention: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array): DepthProjectResult;
/**
 * Unproject one pixel to a unit OpenCV-coordinate ray. Returns
 * `[valid, converged, iterations, x, y, z]`.
 */
export function camera_unproject(camera_model: string, fx: number, fy: number, cx: number, cy: number, coefficients: Float64Array, u: number, v: number): Float64Array;
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
export function tiff_page_count(data: Uint8Array): number;
export function decode_tiff_page_fast(data: Uint8Array, page_index: number): TiffResult;
export function decode_tiff_fast(data: Uint8Array): TiffResult;
export function decode_tiff(data: Uint8Array): TiffResult;
export function extract_exif_tags(data: Uint8Array): string;
export function decode_tiff_page(data: Uint8Array, page_index: number): TiffResult;
export function decode_exr_fast(data: Uint8Array): ExrResult;
export function decode_png_samples_fast(data: Uint8Array): PngResult;
export function decode_png16_fast(data: Uint8Array): PngResult;
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
