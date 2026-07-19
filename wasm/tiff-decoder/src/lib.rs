//! Fast TIFF decoder for WebAssembly
//! 
//! This library provides high-performance TIFF decoding for use in browser environments
//! through WebAssembly. It's designed to be a drop-in replacement for slow parts of
//! geotiff.js while maintaining compatibility with existing JavaScript code.

use wasm_bindgen::prelude::*;
use std::io::Cursor;
use std::mem;
use exr::prelude::FlatSamples;
use tiff::decoder::{Decoder, DecodingResult};

mod camera_models;
use camera_models::{CameraModel, Intrinsics};

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

/// Result type for TIFF decoding operations
#[wasm_bindgen]
pub struct TiffResult {
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    sample_format: u32, // 1=uint, 2=int, 3=float
    // Metadata fields
    compression: u32,
    predictor: u32,
    photometric_interpretation: u32,
    planar_configuration: u32,
    rows_per_strip: u32,
    strip_count: u32,
    strip_byte_count_total: u64,
    strip_byte_count_max: u64,
    tile_width: u32,
    tile_length: u32,
    tile_count: u32,
    direct_decode: bool,
    // Data stored as bytes, interpreted based on sample_format
    data: Vec<u8>,
    // Float representation used by the webview render pipeline. For float TIFFs
    // this avoids converting decoded f32 pixels to bytes and back again.
    data_f32: Vec<f32>,
    // Computed statistics
    min_value: f64,
    max_value: f64,
    timing_metadata_ms: f64,
    timing_decode_ms: f64,
    timing_convert_ms: f64,
    timing_stats_ms: f64,
    timing_pack_ms: f64,
}

#[wasm_bindgen]
pub struct ExrResult {
    width: u32,
    height: u32,
    channels: u32,
    data_f32: Vec<f32>,
    channel_names_csv: String,
    displayed_channels_csv: String,
    format: u32,
    data_type: u32,
    timing_read_ms: f64,
    timing_pack_ms: f64,
    timing_total_ms: f64,
}

#[wasm_bindgen]
pub struct PngResult {
    width: u32,
    height: u32,
    channels: u32,
    bit_depth: u32,
    color_type: u32,
    data_u16: Vec<u16>,
    timing_read_info_ms: f64,
    timing_decode_ms: f64,
    timing_convert_ms: f64,
    timing_total_ms: f64,
}

#[wasm_bindgen]
pub struct DepthProjectResult {
    positions: Vec<f32>,
    colors: Vec<u8>,
    pixel_coords: Vec<u16>,
    point_count: u32,
    width: u32,
    height: u32,
    has_pixel_coords: bool,
    rejected_count: u32,
    non_converged_count: u32,
}

#[wasm_bindgen]
pub struct NormalizeDepthResult {
    data: Vec<f32>,
    width: u32,
    height: u32,
    kind: String,
    unit: String,
}

#[wasm_bindgen]
impl NormalizeDepthResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 { self.width }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.height }

    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String { self.kind.clone() }

    #[wasm_bindgen(getter)]
    pub fn unit(&self) -> String { self.unit.clone() }

    #[wasm_bindgen]
    pub fn take_data(&mut self) -> Vec<f32> {
        mem::take(&mut self.data)
    }
}

#[wasm_bindgen]
impl DepthProjectResult {
    #[wasm_bindgen(getter)]
    pub fn point_count(&self) -> u32 { self.point_count }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 { self.width }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.height }

    #[wasm_bindgen(getter)]
    pub fn has_pixel_coords(&self) -> bool { self.has_pixel_coords }

    #[wasm_bindgen(getter)]
    pub fn rejected_count(&self) -> u32 { self.rejected_count }

    #[wasm_bindgen(getter)]
    pub fn non_converged_count(&self) -> u32 { self.non_converged_count }

    #[wasm_bindgen]
    pub fn take_positions(&mut self) -> Vec<f32> {
        mem::take(&mut self.positions)
    }

    #[wasm_bindgen]
    pub fn take_colors(&mut self) -> Vec<u8> {
        mem::take(&mut self.colors)
    }

    #[wasm_bindgen]
    pub fn take_pixel_coords(&mut self) -> Vec<u16> {
        mem::take(&mut self.pixel_coords)
    }
}

#[wasm_bindgen]
pub struct HdrResult {
    data_f32: Vec<f32>,
    metadata_f64: Vec<f64>,
}

#[wasm_bindgen]
impl HdrResult {
    #[wasm_bindgen]
    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        mem::take(&mut self.data_f32)
    }

    #[wasm_bindgen]
    pub fn take_metadata_as_f64(&mut self) -> Vec<f64> {
        mem::take(&mut self.metadata_f64)
    }
}

#[wasm_bindgen]
impl PngResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 { self.width }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.height }

    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 { self.channels }

    #[wasm_bindgen(getter)]
    pub fn bit_depth(&self) -> u32 { self.bit_depth }

    #[wasm_bindgen(getter)]
    pub fn color_type(&self) -> u32 { self.color_type }

    #[wasm_bindgen(getter)]
    pub fn timing_read_info_ms(&self) -> f64 { self.timing_read_info_ms }

    #[wasm_bindgen(getter)]
    pub fn timing_decode_ms(&self) -> f64 { self.timing_decode_ms }

    #[wasm_bindgen(getter)]
    pub fn timing_convert_ms(&self) -> f64 { self.timing_convert_ms }

    #[wasm_bindgen(getter)]
    pub fn timing_total_ms(&self) -> f64 { self.timing_total_ms }

    #[wasm_bindgen]
    pub fn take_data_as_u16(&mut self) -> Vec<u16> {
        mem::take(&mut self.data_u16)
    }
}

#[wasm_bindgen]
impl ExrResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.channels
    }

    #[wasm_bindgen(getter)]
    pub fn channel_names_csv(&self) -> String {
        self.channel_names_csv.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn displayed_channels_csv(&self) -> String {
        self.displayed_channels_csv.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn format(&self) -> u32 {
        self.format
    }

    #[wasm_bindgen(getter)]
    pub fn data_type(&self) -> u32 {
        self.data_type
    }

    #[wasm_bindgen(getter)]
    pub fn timing_read_ms(&self) -> f64 {
        self.timing_read_ms
    }

    #[wasm_bindgen(getter)]
    pub fn timing_pack_ms(&self) -> f64 {
        self.timing_pack_ms
    }

    #[wasm_bindgen(getter)]
    pub fn timing_total_ms(&self) -> f64 {
        self.timing_total_ms
    }

    #[wasm_bindgen]
    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        mem::take(&mut self.data_f32)
    }
}

#[wasm_bindgen]
impl TiffResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.channels
    }

    #[wasm_bindgen(getter)]
    pub fn bits_per_sample(&self) -> u32 {
        self.bits_per_sample
    }

    #[wasm_bindgen(getter)]
    pub fn sample_format(&self) -> u32 {
        self.sample_format
    }

    #[wasm_bindgen(getter)]
    pub fn min_value(&self) -> f64 {
        self.min_value
    }

    #[wasm_bindgen(getter)]
    pub fn max_value(&self) -> f64 {
        self.max_value
    }

    #[wasm_bindgen(getter)]
    pub fn timing_metadata_ms(&self) -> f64 {
        self.timing_metadata_ms
    }

    #[wasm_bindgen(getter)]
    pub fn timing_decode_ms(&self) -> f64 {
        self.timing_decode_ms
    }

    #[wasm_bindgen(getter)]
    pub fn timing_convert_ms(&self) -> f64 {
        self.timing_convert_ms
    }

    #[wasm_bindgen(getter)]
    pub fn timing_stats_ms(&self) -> f64 {
        self.timing_stats_ms
    }

    #[wasm_bindgen(getter)]
    pub fn timing_pack_ms(&self) -> f64 {
        self.timing_pack_ms
    }

    #[wasm_bindgen(getter)]
    pub fn compression(&self) -> u32 {
        self.compression
    }

    #[wasm_bindgen(getter)]
    pub fn predictor(&self) -> u32 {
        self.predictor
    }

    #[wasm_bindgen(getter)]
    pub fn photometric_interpretation(&self) -> u32 {
        self.photometric_interpretation
    }

    #[wasm_bindgen(getter)]
    pub fn planar_configuration(&self) -> u32 {
        self.planar_configuration
    }

    #[wasm_bindgen(getter)]
    pub fn rows_per_strip(&self) -> u32 {
        self.rows_per_strip
    }

    #[wasm_bindgen(getter)]
    pub fn strip_count(&self) -> u32 {
        self.strip_count
    }

    #[wasm_bindgen(getter)]
    pub fn strip_byte_count_total(&self) -> f64 {
        self.strip_byte_count_total as f64
    }

    #[wasm_bindgen(getter)]
    pub fn strip_byte_count_max(&self) -> f64 {
        self.strip_byte_count_max as f64
    }

    #[wasm_bindgen(getter)]
    pub fn tile_width(&self) -> u32 {
        self.tile_width
    }

    #[wasm_bindgen(getter)]
    pub fn tile_length(&self) -> u32 {
        self.tile_length
    }

    #[wasm_bindgen(getter)]
    pub fn tile_count(&self) -> u32 {
        self.tile_count
    }

    #[wasm_bindgen(getter)]
    pub fn direct_decode(&self) -> bool {
        self.direct_decode
    }

    /// Get raw data as bytes (for transferring to JS)
    #[wasm_bindgen]
    pub fn get_data_bytes(&self) -> Vec<u8> {
        if self.data.is_empty() && !self.data_f32.is_empty() {
            let mut bytes = Vec::with_capacity(self.data_f32.len() * 4);
            for &value in &self.data_f32 {
                bytes.extend_from_slice(&value.to_le_bytes());
            }
            return bytes;
        }
        self.data.clone()
    }

    /// Get data as Float32Array (most common for visualization)
    #[wasm_bindgen]
    pub fn get_data_as_f32(&self) -> Vec<f32> {
        if !self.data_f32.is_empty() {
            return self.data_f32.clone();
        }

        match self.sample_format {
            3 => {
                // Already float32
                self.data
                    .chunks_exact(4)
                    .map(|bytes| f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
                    .collect()
            }
            1 | 2 => {
                // Convert integers to float
                match self.bits_per_sample {
                    8 => self.data.iter().map(|&v| v as f32).collect(),
                    16 => self.data
                        .chunks_exact(2)
                        .map(|bytes| u16::from_le_bytes([bytes[0], bytes[1]]) as f32)
                        .collect(),
                    32 => self.data
                        .chunks_exact(4)
                        .map(|bytes| u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32)
                        .collect(),
                    _ => vec![],
                }
            }
            _ => vec![],
        }
    }

    /// Move float data out of the result when possible. This avoids cloning the
    /// decoded f32 vector before wasm-bindgen copies it into JS-owned memory.
    #[wasm_bindgen]
    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        if !self.data_f32.is_empty() {
            return mem::take(&mut self.data_f32);
        }
        self.get_data_as_f32()
    }
}

#[wasm_bindgen]
pub fn normalize_depth_fast(
    data: &[f32],
    width: u32,
    height: u32,
    kind: &str,
    unit: &str,
    scale: f32,
    depth_scale: f32,
    depth_bias: f32,
    fx: f32,
    baseline: f32,
    disparity_offset: f32,
    has_clamp_min: bool,
    clamp_min: f32,
    has_clamp_max: bool,
    clamp_max: f32,
) -> Result<NormalizeDepthResult, JsValue> {
    let expected = (width as usize)
        .checked_mul(height as usize)
        .ok_or_else(|| JsValue::from_str("Depth dimensions overflow"))?;
    if data.len() < expected {
        return Err(JsValue::from_str("Depth data is smaller than width*height"));
    }

    let mut out = Vec::with_capacity(expected);
    out.extend_from_slice(&data[..expected]);

    let unit_scale = if kind == "depth" || kind == "z" {
        if unit == "millimeter" { 0.001 * scale } else { scale }
    } else {
        1.0
    };
    let has_depth_scale_bias = depth_scale != 1.0 || depth_bias != 0.0;

    if unit_scale != 1.0 {
        for v in &mut out {
            *v *= unit_scale;
        }
    }

    if has_depth_scale_bias {
        for v in &mut out {
            if v.is_finite() {
                *v = *v * depth_scale + depth_bias;
            }
        }
    }

    let mut normalized_kind = kind.to_string();
    let mut normalized_unit = unit.to_string();
    if kind == "disparity" && fx > 0.0 && baseline > 0.0 {
        let eps = 1e-8f32;
        for v in &mut out {
            let d = *v + disparity_offset;
            *v = if d > eps { (fx * baseline) / d } else { f32::NAN };
        }
        normalized_kind = "depth".to_string();
        normalized_unit = "meter".to_string();
    } else if kind == "inverse_depth" {
        let inverse_scale = if unit == "millimeter" { 0.001 * scale } else { scale };
        for v in &mut out {
            let id = *v * inverse_scale;
            *v = if id > 0.0 { 1.0 / id } else { f32::NAN };
        }
        normalized_kind = "depth".to_string();
        normalized_unit = "meter".to_string();
    }

    if has_clamp_min || has_clamp_max {
        for v in &mut out {
            if has_clamp_min && *v < clamp_min {
                *v = f32::NAN;
            }
            if has_clamp_max && *v > clamp_max {
                *v = f32::NAN;
            }
        }
    }

    Ok(NormalizeDepthResult {
        data: out,
        width,
        height,
        kind: normalized_kind,
        unit: normalized_unit,
    })
}

#[wasm_bindgen]
pub fn project_depth_fast(
    data: &[f32],
    width: u32,
    height: u32,
    kind: &str,
    camera_model: &str,
    convention: &str,
    fx: f32,
    fy: f32,
    cx: f32,
    cy: f32,
    coefficients: &[f64],
) -> Result<DepthProjectResult, JsValue> {
    let expected = (width as usize)
        .checked_mul(height as usize)
        .ok_or_else(|| JsValue::from_str("Depth dimensions overflow"))?;
    if data.len() < expected {
        return Err(JsValue::from_str("Depth data is smaller than width*height"));
    }
    let model = CameraModel::parse(camera_model).map_err(|error| JsValue::from_str(&error))?;
    let intrinsics = Intrinsics {
        fx: fx as f64,
        fy: fy as f64,
        cx: cx as f64,
        cy: cy as f64,
    };
    camera_models::validate(model, intrinsics, coefficients)
        .map_err(|error| JsValue::from_str(&error))?;

    let mut valid_count = 0usize;
    let mut min_depth = f32::INFINITY;
    let mut max_depth = f32::NEG_INFINITY;
    for &v in data.iter().take(expected) {
        if v.is_finite() && v > 0.0 {
            valid_count += 1;
            if v < min_depth { min_depth = v; }
            if v > max_depth { max_depth = v; }
        }
    }

    let mut positions = Vec::with_capacity(valid_count * 3);
    let mut colors = Vec::with_capacity(valid_count * 3);
    let needs_pixel_coords = matches!(model, CameraModel::PinholeOpenCv | CameraModel::FisheyeOpenCv | CameraModel::FisheyeKb3 | CameraModel::Fisheye624);
    let mut pixel_coords = if needs_pixel_coords { Vec::with_capacity(valid_count * 2) } else { Vec::new() };

    let is_z_depth = kind == "z";
    let convention_sign = if convention == "opengl" { -1.0 } else { 1.0 };
    let log_min = if valid_count > 0 { min_depth.ln() } else { 0.0 };
    let log_max = if valid_count > 0 { max_depth.ln() } else { 0.0 };
    let denom = log_max - log_min;
    let inv_denom = if denom > 0.0 { 1.0 / denom } else { 0.0 };

    let mut point_index = 0usize;
    let mut rejected_count = 0u32;
    let mut non_converged_count = 0u32;
    for v in 0..height as usize {
        for u in 0..width as usize {
            let depth_value = data[v * width as usize + u];
            if !depth_value.is_finite() || depth_value <= 0.0 {
                continue;
            }
            let ray = camera_models::unproject(model, intrinsics, coefficients, [u as f64, v as f64]);
            if !ray.converged || ray.value.iter().any(|value| !value.is_finite()) {
                rejected_count += 1;
                if ray.iterations > 0 { non_converged_count += 1; }
                continue;
            }
            let scale = if is_z_depth {
                if ray.value[2] <= 1e-12 {
                    rejected_count += 1;
                    continue;
                }
                depth_value as f64 / ray.value[2]
            } else {
                depth_value as f64
            };
            positions.push((ray.value[0] * scale) as f32);
            positions.push((ray.value[1] * scale * convention_sign as f64) as f32);
            positions.push((ray.value[2] * scale * convention_sign as f64) as f32);

            let s = if denom > 0.0 { (depth_value.ln() - log_min) * inv_denom } else { 1.0 };
            let gray = (51.5 + 204.0 * s) as u8;
            colors.extend_from_slice(&[gray, gray, gray]);
            if needs_pixel_coords {
                pixel_coords.push(u.min(u16::MAX as usize) as u16);
                pixel_coords.push(v.min(u16::MAX as usize) as u16);
            }
            point_index += 1;
        }
    }

    Ok(DepthProjectResult {
        positions,
        colors,
        pixel_coords,
        point_count: point_index as u32,
        width,
        height,
        has_pixel_coords: needs_pixel_coords && point_index > 0,
        rejected_count,
        non_converged_count,
    })
}

/// Project one OpenCV-coordinate ray. Returns
/// `[valid, converged, iterations, u, v]`.
#[wasm_bindgen]
pub fn camera_project(
    camera_model: &str,
    fx: f64,
    fy: f64,
    cx: f64,
    cy: f64,
    coefficients: &[f64],
    x: f64,
    y: f64,
    z: f64,
) -> Result<Vec<f64>, JsValue> {
    let model = CameraModel::parse(camera_model).map_err(|error| JsValue::from_str(&error))?;
    let intrinsics = Intrinsics { fx, fy, cx, cy };
    camera_models::validate(model, intrinsics, coefficients)
        .map_err(|error| JsValue::from_str(&error))?;
    let result = camera_models::project(model, intrinsics, coefficients, [x, y, z]);
    Ok(vec![
        if result.converged && result.value.iter().all(|value| value.is_finite()) { 1.0 } else { 0.0 },
        if result.converged { 1.0 } else { 0.0 },
        result.iterations as f64,
        result.value[0],
        result.value[1],
    ])
}

/// Unproject one pixel to a unit OpenCV-coordinate ray. Returns
/// `[valid, converged, iterations, x, y, z]`.
#[wasm_bindgen]
pub fn camera_unproject(
    camera_model: &str,
    fx: f64,
    fy: f64,
    cx: f64,
    cy: f64,
    coefficients: &[f64],
    u: f64,
    v: f64,
) -> Result<Vec<f64>, JsValue> {
    let model = CameraModel::parse(camera_model).map_err(|error| JsValue::from_str(&error))?;
    let intrinsics = Intrinsics { fx, fy, cx, cy };
    camera_models::validate(model, intrinsics, coefficients)
        .map_err(|error| JsValue::from_str(&error))?;
    let result = camera_models::unproject(model, intrinsics, coefficients, [u, v]);
    Ok(vec![
        if result.converged && result.value.iter().all(|value| value.is_finite()) { 1.0 } else { 0.0 },
        if result.converged { 1.0 } else { 0.0 },
        result.iterations as f64,
        result.value[0],
        result.value[1],
        result.value[2],
    ])
}

/// Decode a TIFF file from an ArrayBuffer
/// Returns TiffResult with image data and metadata
#[wasm_bindgen]
pub fn decode_tiff(data: &[u8]) -> Result<TiffResult, JsValue> {
    decode_tiff_impl(data, true)
}

/// Decode a TIFF file without eagerly computing min/max statistics.
///
/// The webview render path computes stats lazily when a non-gamma mode needs
/// them. Skipping eager stats saves a full pass over large float TIFFs during
/// the common gamma-mode initial load.
#[wasm_bindgen]
pub fn decode_tiff_fast(data: &[u8]) -> Result<TiffResult, JsValue> {
    decode_tiff_impl(data, false)
}

#[wasm_bindgen]
pub fn decode_exr_fast(data: &[u8]) -> Result<ExrResult, JsValue> {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    decode_exr_impl(data)
}

#[wasm_bindgen]
pub fn decode_png16_fast(data: &[u8]) -> Result<PngResult, JsValue> {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    decode_png16_impl(data)
}

fn decode_png16_impl(data: &[u8]) -> Result<PngResult, JsValue> {
    let start_time = js_sys::Date::now();
    let cursor = Cursor::new(data);
    let mut limits = png::Limits::default();
    limits.bytes = 512 * 1024 * 1024;
    let decoder = png::Decoder::new_with_limits(cursor, limits);
    let mut reader = decoder.read_info()
        .map_err(|e| JsValue::from_str(&format!("Failed to read PNG info: {}", e)))?;
    let read_info_time = js_sys::Date::now() - start_time;

    let decode_start = js_sys::Date::now();
    let mut raw = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut raw)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode PNG frame: {}", e)))?;
    raw.truncate(info.buffer_size());
    let decode_time = js_sys::Date::now() - decode_start;

    if info.bit_depth != png::BitDepth::Sixteen {
        return Err(JsValue::from_str("Rust PNG fast path only supports 16-bit PNG output"));
    }
    let channels = match info.color_type {
        png::ColorType::Grayscale => 1,
        png::ColorType::Rgb => 3,
        png::ColorType::GrayscaleAlpha => 2,
        png::ColorType::Rgba => 4,
        png::ColorType::Indexed => return Err(JsValue::from_str("Rust PNG fast path does not support indexed 16-bit PNG")),
    };

    let expected_values = (info.width as usize)
        .checked_mul(info.height as usize)
        .and_then(|v| v.checked_mul(channels as usize))
        .ok_or_else(|| JsValue::from_str("PNG dimensions overflow"))?;
    if raw.len() < expected_values * 2 {
        return Err(JsValue::from_str("PNG decoded byte count is smaller than expected"));
    }

    let convert_start = js_sys::Date::now();
    let mut values: Vec<u16> = Vec::with_capacity(expected_values);
    let src_ptr = raw.as_ptr();
    let dst = values.as_mut_ptr();
    for i in 0..expected_values {
        // SAFETY: `raw` was checked to contain at least `expected_values * 2`
        // bytes, and `values` has capacity for every output sample.
        unsafe {
            let be = (src_ptr.add(i * 2) as *const u16).read_unaligned();
            dst.add(i).write(u16::from_be(be));
        }
    }
    unsafe {
        values.set_len(expected_values);
    }
    let convert_time = js_sys::Date::now() - convert_start;
    let total_time = js_sys::Date::now() - start_time;

    Ok(PngResult {
        width: info.width,
        height: info.height,
        channels,
        bit_depth: 16,
        color_type: png_color_type_to_u32(info.color_type),
        data_u16: values,
        timing_read_info_ms: read_info_time,
        timing_decode_ms: decode_time,
        timing_convert_ms: convert_time,
        timing_total_ms: total_time,
    })
}

fn png_color_type_to_u32(color_type: png::ColorType) -> u32 {
    match color_type {
        png::ColorType::Grayscale => 0,
        png::ColorType::Rgb => 2,
        png::ColorType::Indexed => 3,
        png::ColorType::GrayscaleAlpha => 4,
        png::ColorType::Rgba => 6,
    }
}

#[wasm_bindgen]
pub fn decode_hdr_fast(data: &[u8]) -> Result<HdrResult, JsValue> {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    decode_hdr_impl(data)
}

fn decode_hdr_impl(data: &[u8]) -> Result<HdrResult, JsValue> {
    let start_time = js_sys::Date::now();
    let mut offset = 0usize;
    let mut width = 0usize;
    let mut height = 0usize;
    let mut exposure = 1.0f32;
    let mut gamma = 1.0f32;
    let mut rle = false;

    for _ in 0..128 {
        let line_start = offset;
        while offset < data.len() && data[offset] != b'\n' {
            offset += 1;
        }
        if offset >= data.len() {
            return Err(JsValue::from_str("HDR header ended before resolution line"));
        }
        let line_bytes = &data[line_start..offset];
        offset += 1;
        let line = std::str::from_utf8(line_bytes)
            .map_err(|_| JsValue::from_str("HDR header is not UTF-8"))?
            .trim();
        if line == "FORMAT=32-bit_rle_rgbe" {
            rle = true;
        } else if let Some(value) = line.strip_prefix("EXPOSURE=") {
            exposure = value.trim().parse::<f32>().unwrap_or(1.0);
        } else if let Some(value) = line.strip_prefix("GAMMA=") {
            gamma = value.trim().parse::<f32>().unwrap_or(1.0);
        } else if line.starts_with("-Y ") && line.contains(" +X ") {
            let mut parts = line.split_whitespace();
            if parts.next() == Some("-Y") {
                height = parts.next()
                    .ok_or_else(|| JsValue::from_str("Missing HDR height"))?
                    .parse::<usize>()
                    .map_err(|_| JsValue::from_str("Invalid HDR height"))?;
                if parts.next() != Some("+X") {
                    return Err(JsValue::from_str("Unsupported HDR orientation"));
                }
                width = parts.next()
                    .ok_or_else(|| JsValue::from_str("Missing HDR width"))?
                    .parse::<usize>()
                    .map_err(|_| JsValue::from_str("Invalid HDR width"))?;
                break;
            }
        }
    }

    let header_time = js_sys::Date::now() - start_time;
    if width == 0 || height == 0 {
        return Err(JsValue::from_str("HDR resolution line not found"));
    }
    if !rle {
        return Err(JsValue::from_str("Only FORMAT=32-bit_rle_rgbe HDR files are supported"));
    }
    if width > 0x7fff {
        return Err(JsValue::from_str("HDR scanline is too wide for RLE"));
    }

    let pixel_count = width.checked_mul(height)
        .ok_or_else(|| JsValue::from_str("HDR dimensions overflow"))?;
    let mut scanline = vec![0u8; width * 4];
    let mut output = vec![0f32; pixel_count * 4];
    let mut scales = [0f32; 256];
    for e in 1..256 {
        scales[e] = 2f32.powi(e as i32 - 128) / 255.0;
    }
    let mut rle_time = 0.0;
    let mut convert_time = 0.0;

    for y in 0..height {
        let rle_start = js_sys::Date::now();
        if offset + 4 > data.len() {
            return Err(JsValue::from_str("Unexpected EOF in HDR scanline header"));
        }
        let b0 = data[offset];
        let b1 = data[offset + 1];
        let b2 = data[offset + 2];
        let b3 = data[offset + 3];
        offset += 4;
        if b0 != 2 || b1 != 2 || (b2 & 0x80) != 0 {
            return Err(JsValue::from_str("HDR file is not new-style RLE encoded"));
        }
        let scanline_width = ((b2 as usize) << 8) | b3 as usize;
        if scanline_width != width {
            return Err(JsValue::from_str("HDR scanline width mismatch"));
        }
        for channel in 0..4 {
            let mut ptr = channel * width;
            let end = ptr + width;
            while ptr < end {
                if offset + 2 > data.len() {
                    return Err(JsValue::from_str("Unexpected EOF in HDR RLE data"));
                }
                let count_byte = data[offset];
                let value = data[offset + 1];
                offset += 2;
                if count_byte > 128 {
                    let count = (count_byte - 128) as usize;
                    if count == 0 || ptr + count > end {
                        return Err(JsValue::from_str("Bad HDR RLE run"));
                    }
                    scanline[ptr..ptr + count].fill(value);
                    ptr += count;
                } else {
                    let count = count_byte as usize;
                    if count == 0 || ptr + count > end {
                        return Err(JsValue::from_str("Bad HDR RLE literal"));
                    }
                    scanline[ptr] = value;
                    ptr += 1;
                    if count > 1 {
                        let remaining = count - 1;
                        if offset + remaining > data.len() {
                            return Err(JsValue::from_str("Unexpected EOF in HDR literal"));
                        }
                        scanline[ptr..ptr + remaining].copy_from_slice(&data[offset..offset + remaining]);
                        ptr += remaining;
                        offset += remaining;
                    }
                }
            }
        }
        rle_time += js_sys::Date::now() - rle_start;

        let convert_start = js_sys::Date::now();
        let row_offset = y * width * 4;
        for x in 0..width {
            let e = scanline[x + width * 3] as usize;
            let out = row_offset + x * 4;
            if e == 0 {
                output[out] = 0.0;
                output[out + 1] = 0.0;
                output[out + 2] = 0.0;
            } else {
                let scale = scales[e];
                output[out] = scanline[x] as f32 * scale;
                output[out + 1] = scanline[x + width] as f32 * scale;
                output[out + 2] = scanline[x + width * 2] as f32 * scale;
            }
            output[out + 3] = 1.0;
        }
        convert_time += js_sys::Date::now() - convert_start;
    }

    Ok(HdrResult {
        data_f32: output,
        metadata_f64: vec![
            width as f64,
            height as f64,
            exposure as f64,
            gamma as f64,
            header_time,
            rle_time,
            convert_time,
            js_sys::Date::now() - start_time,
        ],
    })
}

fn decode_exr_impl(data: &[u8]) -> Result<ExrResult, JsValue> {
    use exr::prelude::*;

    let start_time = js_sys::Date::now();
    let cursor = Cursor::new(data);
    let image = read()
        .no_deep_data()
        .largest_resolution_level()
        .all_channels()
        .first_valid_layer()
        .all_attributes()
        .from_buffered(cursor)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode EXR: {}", e)))?;
    let read_time = js_sys::Date::now() - start_time;
    let pack_start = js_sys::Date::now();

    let layer = image.layer_data;
    let width = layer.size.0;
    let height = layer.size.1;
    if width == 0 || height == 0 {
        return Err(JsValue::from_str("EXR has empty dimensions"));
    }

    let mut channels = layer.channel_data.list;
    if channels.is_empty() {
        return Err(JsValue::from_str("EXR has no flat channels"));
    }

    let pixel_count = width
        .checked_mul(height)
        .ok_or_else(|| JsValue::from_str("EXR dimensions overflow"))?;
    let channel_names: Vec<String> = channels.iter().map(|channel| channel.name.to_string()).collect();
    let selection = select_exr_display_channels(&channel_names);
    if selection.source_indices.is_empty() {
        return Err(JsValue::from_str("EXR has no displayable channels"));
    }

    for &index in selection.source_indices.iter().flatten() {
        let channel = &channels[index];
        if channel.sampling.0 != 1 || channel.sampling.1 != 1 {
            return Err(JsValue::from_str("Subsampled EXR channels are not supported by the Rust fast path"));
        }
        if channel.sample_data.len() < pixel_count {
            return Err(JsValue::from_str("EXR channel sample count is smaller than the image dimensions"));
        }
    }

    let output_channels = selection.source_indices.len();
    let interleaved = if output_channels == 1 {
        let source_index = selection.source_indices[0]
            .ok_or_else(|| JsValue::from_str("EXR grayscale selection unexpectedly has no source channel"))?;
        let samples = mem::replace(&mut channels[source_index].sample_data, FlatSamples::F32(Vec::new()));
        exr_samples_into_f32_vec(samples, pixel_count)
    } else {
        let mut interleaved = vec![0.0f32; pixel_count * output_channels];
        for (out_channel, source_index) in selection.source_indices.iter().enumerate() {
            if let Some(source_index) = source_index {
                copy_exr_channel_to_interleaved(
                    &channels[*source_index].sample_data,
                    &mut interleaved,
                    out_channel,
                    output_channels,
                    pixel_count,
                );
            } else {
                fill_exr_interleaved_channel(&mut interleaved, out_channel, output_channels, pixel_count, 1.0);
            }
        }
        interleaved
    };

    let format = if output_channels == 1 { 1028 } else { 1023 };
    let pack_time = js_sys::Date::now() - pack_start;
    let total_time = js_sys::Date::now() - start_time;

    Ok(ExrResult {
        width: width as u32,
        height: height as u32,
        channels: output_channels as u32,
        data_f32: interleaved,
        channel_names_csv: channel_names.join(","),
        displayed_channels_csv: selection.displayed_names.join(","),
        format,
        data_type: 1015,
        timing_read_ms: read_time,
        timing_pack_ms: pack_time,
        timing_total_ms: total_time,
    })
}

struct ExrChannelSelection {
    source_indices: Vec<Option<usize>>,
    displayed_names: Vec<String>,
}

fn select_exr_display_channels(channel_names: &[String]) -> ExrChannelSelection {
    let mut y = None;
    let mut r = None;
    let mut g = None;
    let mut b = None;
    let mut a = None;

    for (index, name) in channel_names.iter().enumerate() {
        let base = exr_base_channel_name(name);
        match base {
            "Y" => y.get_or_insert(index),
            "R" => r.get_or_insert(index),
            "G" => g.get_or_insert(index),
            "B" => b.get_or_insert(index),
            "A" => a.get_or_insert(index),
            "Z" | "z" | "depth" | "Depth" | "DEPTH" => y.get_or_insert(index),
            _ if channel_names.len() == 1 => y.get_or_insert(index),
            _ => continue,
        };
    }

    if let (Some(r), Some(g), Some(b)) = (r, g, b) {
        let mut source_indices = vec![Some(r), Some(g), Some(b)];
        let mut displayed_names = vec![
            channel_names[r].clone(),
            channel_names[g].clone(),
            channel_names[b].clone(),
        ];
        if let Some(a) = a {
            source_indices.push(Some(a));
            displayed_names.push(channel_names[a].clone());
        } else {
            source_indices.push(None);
        }
        return ExrChannelSelection { source_indices, displayed_names };
    }

    if let Some(index) = y {
        return ExrChannelSelection {
            source_indices: vec![Some(index)],
            displayed_names: vec![channel_names[index].clone()],
        };
    }

    for (index, name) in channel_names.iter().enumerate() {
        let base = exr_base_channel_name(name);
        if base == "R" || base == "G" || base == "B" {
            return ExrChannelSelection {
                source_indices: vec![Some(index)],
                displayed_names: vec![channel_names[index].clone()],
            };
        }
    }

    ExrChannelSelection { source_indices: Vec::new(), displayed_names: Vec::new() }
}

fn exr_base_channel_name(name: &str) -> &str {
    name.rsplit('.').next().unwrap_or(name)
}

fn copy_exr_channel_to_interleaved(
    samples: &FlatSamples,
    out: &mut [f32],
    out_channel: usize,
    output_channels: usize,
    pixel_count: usize,
) {
    match samples {
        FlatSamples::F16(values) => {
            for i in 0..pixel_count {
                out[i * output_channels + out_channel] = values[i].to_f32();
            }
        }
        FlatSamples::F32(values) => {
            for i in 0..pixel_count {
                out[i * output_channels + out_channel] = values[i];
            }
        }
        FlatSamples::U32(values) => {
            for i in 0..pixel_count {
                out[i * output_channels + out_channel] = values[i] as f32;
            }
        }
    }
}

fn exr_samples_into_f32_vec(samples: FlatSamples, pixel_count: usize) -> Vec<f32> {
    match samples {
        FlatSamples::F16(values) => {
            let mut out = Vec::with_capacity(pixel_count);
            for value in values.into_iter().take(pixel_count) {
                out.push(value.to_f32());
            }
            out
        }
        FlatSamples::F32(mut values) => {
            values.truncate(pixel_count);
            values
        }
        FlatSamples::U32(values) => {
            let mut out = Vec::with_capacity(pixel_count);
            for value in values.into_iter().take(pixel_count) {
                out.push(value as f32);
            }
            out
        }
    }
}

fn fill_exr_interleaved_channel(
    out: &mut [f32],
    out_channel: usize,
    output_channels: usize,
    pixel_count: usize,
    value: f32,
) {
    for i in 0..pixel_count {
        out[i * output_channels + out_channel] = value;
    }
}

fn decode_tiff_impl(data: &[u8], compute_stats: bool) -> Result<TiffResult, JsValue> {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    let start_time = js_sys::Date::now();

    let cursor = Cursor::new(data);
    let mut decoder = Decoder::new(cursor)
        .map_err(|e| JsValue::from_str(&format!("Failed to create decoder: {}", e)))?;

    let (width, height) = decoder.dimensions()
        .map_err(|e| JsValue::from_str(&format!("Failed to get dimensions: {}", e)))?;

    // Palette (RGBPalette, PhotometricInterpretation 3) images are rejected by
    // the tiff crate's colortype()/read_image(), so handle them via a dedicated
    // index + ColorMap path before those calls error out.
    let photometric_early = decoder.get_tag_u32(tiff::tags::Tag::PhotometricInterpretation).unwrap_or(1);
    if photometric_early == 3 {
        return decode_palette(data, width, height);
    }

    // Get color type and bits per sample
    let color_type = decoder.colortype()
        .map_err(|e| JsValue::from_str(&format!("Failed to get color type: {}", e)))?;

    let channels = match color_type {
        tiff::ColorType::Gray(_) => 1,
        tiff::ColorType::GrayA(_) => 2,
        tiff::ColorType::RGB(_) => 3,
        tiff::ColorType::RGBA(_) => 4,
        tiff::ColorType::CMYK(_) => 4,
        // JPEG-compressed TIFFs are commonly stored as YCbCr; the tiff crate
        // decodes them to interleaved RGB, so report 3 channels here.
        tiff::ColorType::YCbCr(_) => 3,
        _ => 1,
    };

    // Try to get bits per sample
    let mut bits_per_sample = match &color_type {
        tiff::ColorType::Gray(bits) => *bits as u32,
        tiff::ColorType::GrayA(bits) => *bits as u32,
        tiff::ColorType::RGB(bits) => *bits as u32,
        tiff::ColorType::RGBA(bits) => *bits as u32,
        tiff::ColorType::CMYK(bits) => *bits as u32,
        tiff::ColorType::YCbCr(bits) => *bits as u32,
        _ => 8,
    };

    // Extract metadata from decoder
    // Get compression method (default to 1 = None if not found)
    let compression = decoder.get_tag_u32(tiff::tags::Tag::Compression)
        .unwrap_or(1);
    
    // Get predictor (default to 1 = None if not found)
    let predictor = decoder.get_tag_u32(tiff::tags::Tag::Predictor)
        .unwrap_or(1);
    
    // Get photometric interpretation (default to 1 = BlackIsZero if not found)
    let photometric_interpretation = decoder.get_tag_u32(tiff::tags::Tag::PhotometricInterpretation)
        .unwrap_or(1);
    
    // Get planar configuration (default to 1 = Chunky if not found)
    let planar_configuration = decoder.get_tag_u32(tiff::tags::Tag::PlanarConfiguration)
        .unwrap_or(1);

    let rows_per_strip = decoder.get_tag_u32(tiff::tags::Tag::RowsPerStrip).unwrap_or(height);
    let strip_byte_counts = decoder.get_tag_u64_vec(tiff::tags::Tag::StripByteCounts).unwrap_or_default();
    let strip_count = strip_byte_counts.len() as u32;
    let strip_byte_count_total = strip_byte_counts.iter().copied().sum::<u64>();
    let strip_byte_count_max = strip_byte_counts.iter().copied().max().unwrap_or(0);
    let tile_width = decoder.get_tag_u32(tiff::tags::Tag::TileWidth).unwrap_or(0);
    let tile_length = decoder.get_tag_u32(tiff::tags::Tag::TileLength).unwrap_or(0);
    let tile_count = decoder.get_tag_u64_vec(tiff::tags::Tag::TileByteCounts)
        .map(|counts| counts.len() as u32)
        .unwrap_or(0);

    // CCITT fax compressions: 2 (Modified Huffman), 3 (Group 3 / T.4) and
    // 4 (Group 4 / T.6). The tiff crate only decodes Group 4, so route all of
    // them through hayro-ccitt, which understands the TIFF encoding options.
    if compression == 2 || compression == 3 || compression == 4 {
        let offsets = decoder.get_tag_u64_vec(tiff::tags::Tag::StripOffsets)
            .map_err(|e| JsValue::from_str(&format!("CCITT: missing StripOffsets: {}", e)))?;
        let counts = decoder.get_tag_u64_vec(tiff::tags::Tag::StripByteCounts)
            .map_err(|e| JsValue::from_str(&format!("CCITT: missing StripByteCounts: {}", e)))?;
        // FillOrder defaults to 1 (MSB first); T4Options (tag 292) defaults to 0.
        let fill_order = decoder.get_tag_u32(tiff::tags::Tag::FillOrder).unwrap_or(1);
        let t4_options = decoder.get_tag_u32(tiff::tags::Tag::Unknown(292)).unwrap_or(0);
        // Each strip is an independent CCITT stream; default to a single strip.
        let rows_per_strip = decoder.get_tag_u32(tiff::tags::Tag::RowsPerStrip).unwrap_or(height);
        return decode_ccitt(
            data, width, height, compression, predictor,
            photometric_interpretation, planar_configuration,
            &offsets, &counts, fill_order, t4_options, rows_per_strip,
        );
    }

    // JPEG-compressed YCbCr (compression 7, PhotometricInterpretation 6). The
    // tiff crate applies a YCbCr->RGB conversion on top of zune-jpeg's already
    // converted RGB output (a double conversion), which tints grayscale-stored
    // images. Decode the JPEG strips directly with zune-jpeg, which is correct.
    if compression == 7 && photometric_interpretation == 6 {
        return decode_jpeg_ycbcr(data, &mut decoder, width, height);
    }

    let decode_start = js_sys::Date::now();

    // Read image data (decompression happens here). ZSTD (50000) is decoded
    // with the pure-Rust ruzstd crate rather than the tiff crate's C zstd, so
    // the WASM build needs no C toolchain. The decompressed strips are rebuilt
    // into an uncompressed TIFF and handed back to the tiff crate, which still
    // performs predictor un-application and type/endianness handling.
    let mut direct_decode = false;
    let decode_result = if compression == 50000 {
        decode_zstd(data, &mut decoder)?
    } else if let Some(result) = try_decode_uncompressed_strips(
        data,
        &mut decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
    )? {
        direct_decode = true;
        result
    } else {
        decoder.read_image()
            .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))?
    };
    
    let decompress_time = js_sys::Date::now() - decode_start;
    let convert_start = js_sys::Date::now();
    let mut stats_time = 0.0;
    let mut pack_time = 0.0;

    // Determine sample format and convert data to bytes
    let (data_bytes, data_f32, sample_format, min_val, max_val) = match decode_result {
        DecodingResult::U8(data) => {
            if bits_per_sample == 1 {
                // Uncompressed (or LZW/PackBits/Deflate) bilevel images are
                // returned as MSB-first packed bits with each row padded to a
                // byte boundary. Expand to one byte per pixel so they render
                // like any other 8-bit grayscale image.
                let pack_start = js_sys::Date::now();
                let expanded = unpack_bilevel(&data, width, height, photometric_interpretation);
                bits_per_sample = 8;
                pack_time += js_sys::Date::now() - pack_start;
                let (min, max) = if compute_stats {
                    let stats_start = js_sys::Date::now();
                    let stats = compute_stats_u8(&expanded);
                    stats_time += js_sys::Date::now() - stats_start;
                    (stats.0 as f64, stats.1 as f64)
                } else {
                    (f64::NAN, f64::NAN)
                };
                (expanded, Vec::new(), 1u32, min, max)
            } else {
                let (min, max) = if compute_stats {
                    let stats_start = js_sys::Date::now();
                    let stats = compute_stats_u8(&data);
                    stats_time += js_sys::Date::now() - stats_start;
                    (stats.0 as f64, stats.1 as f64)
                } else {
                    (f64::NAN, f64::NAN)
                };
                (data, Vec::new(), 1u32, min, max)
            }
        }
        DecodingResult::U16(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_u16(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            // SIMD-optimized byte conversion
            let pack_start = js_sys::Date::now();
            let bytes = convert_u16_to_bytes_simd(&data);
            pack_time += js_sys::Date::now() - pack_start;
            (bytes, Vec::new(), 1u32, min, max)
        }
        DecodingResult::U32(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_u32(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let bytes: Vec<u8> = data.iter()
                .flat_map(|&v| v.to_le_bytes())
                .collect();
            pack_time += js_sys::Date::now() - pack_start;
            (bytes, Vec::new(), 1u32, min, max)
        }
        DecodingResult::U64(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_u64(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let bytes: Vec<u8> = data.iter()
                .flat_map(|&v| v.to_le_bytes())
                .collect();
            pack_time += js_sys::Date::now() - pack_start;
            (bytes, Vec::new(), 1u32, min, max)
        }
        DecodingResult::I8(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_i8(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let ubytes: Vec<u8> = data.iter().map(|&v| v as u8).collect();
            pack_time += js_sys::Date::now() - pack_start;
            (ubytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::I16(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_i16(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let bytes: Vec<u8> = data.iter()
                .flat_map(|&v| v.to_le_bytes())
                .collect();
            pack_time += js_sys::Date::now() - pack_start;
            (bytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::I32(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_i32(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let bytes: Vec<u8> = data.iter()
                .flat_map(|&v| v.to_le_bytes())
                .collect();
            pack_time += js_sys::Date::now() - pack_start;
            (bytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::I64(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_i64(&data);
                stats_time += js_sys::Date::now() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let bytes: Vec<u8> = data.iter()
                .flat_map(|&v| v.to_le_bytes())
                .collect();
            pack_time += js_sys::Date::now() - pack_start;
            (bytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::F32(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_f32(&data);
                stats_time += js_sys::Date::now() - stats_start;
                stats
            } else {
                (f64::NAN, f64::NAN)
            };
            (Vec::new(), data, 3u32, min, max)
        }
        DecodingResult::F64(data) => {
            let (min, max) = if compute_stats {
                let stats_start = js_sys::Date::now();
                let stats = compute_stats_f64(&data);
                stats_time += js_sys::Date::now() - stats_start;
                stats
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = js_sys::Date::now();
            let mut values = Vec::with_capacity(data.len());
            for &val in &data {
                values.push(val as f32);
            }
            pack_time += js_sys::Date::now() - pack_start;
            (Vec::new(), values, 3u32, min, max)
        }
        DecodingResult::F16(data) => {
            // Convert f16 to f32 for processing and pre-allocate
            let pack_start = js_sys::Date::now();
            let mut values = Vec::with_capacity(data.len());
            let mut min_val = f32::INFINITY;
            let mut max_val = f32::NEG_INFINITY;

            if compute_stats {
                for &val in &data {
                    let f32_val = val.to_f32();
                    if f32_val < min_val { min_val = f32_val; }
                    if f32_val > max_val { max_val = f32_val; }
                    values.push(f32_val);
                }
            } else {
                for &val in &data {
                    values.push(val.to_f32());
                }
            }
            pack_time += js_sys::Date::now() - pack_start;
            let min = if compute_stats { min_val as f64 } else { f64::NAN };
            let max = if compute_stats { max_val as f64 } else { f64::NAN };
            (Vec::new(), values, 3u32, min, max)
        }
    };

    let convert_time = js_sys::Date::now() - convert_start;
    let total_time = js_sys::Date::now() - start_time;
    let metadata_time = total_time - decompress_time - convert_time;

    let result = Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample,
        sample_format,
        compression,
        predictor,
        photometric_interpretation,
        planar_configuration,
        rows_per_strip,
        strip_count,
        strip_byte_count_total,
        strip_byte_count_max,
        tile_width,
        tile_length,
        tile_count,
        direct_decode,
        data: data_bytes,
        data_f32,
        min_value: min_val,
        max_value: max_val,
        timing_metadata_ms: metadata_time,
        timing_decode_ms: decompress_time,
        timing_convert_ms: convert_time,
        timing_stats_ms: stats_time,
        timing_pack_ms: pack_time,
    });

    web_sys::console::log_1(&format!(
        "[Rust] Total: {:.2}ms (metadata: {:.2}ms, decompress: {:.2}ms, convert: {:.2}ms)", 
        total_time, metadata_time, decompress_time, convert_time
    ).into());
    
    result
}

fn tiff_is_little_endian(data: &[u8]) -> Option<bool> {
    match data.get(0..4)? {
        b"II*\0" | b"II+\0" => Some(true),
        b"MM\0*" | b"MM\0+" => Some(false),
        _ => None,
    }
}

fn try_decode_uncompressed_strips(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    compression: u32,
    predictor: u32,
    planar_configuration: u32,
) -> Result<Option<DecodingResult>, JsValue> {
    use tiff::tags::Tag;

    if compression != 1 || predictor != 1 || planar_configuration != 1 {
        return Ok(None);
    }
    if bits_per_sample == 0 || bits_per_sample % 8 != 0 {
        return Ok(None);
    }
    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Ok(None);
    }

    let little_endian = match tiff_is_little_endian(data) {
        Some(value) => value,
        None => return Ok(None),
    };
    let offsets = match decoder.get_tag_u64_vec(Tag::StripOffsets) {
        Ok(value) if !value.is_empty() => value,
        _ => return Ok(None),
    };
    let counts = match decoder.get_tag_u64_vec(Tag::StripByteCounts) {
        Ok(value) if value.len() == offsets.len() => value,
        _ => return Ok(None),
    };

    let sample_format = decoder.get_tag_u64_vec(Tag::SampleFormat)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(1) as u32;
    let sample_count = (width as usize)
        .checked_mul(height as usize)
        .and_then(|v| v.checked_mul(channels as usize))
        .ok_or_else(|| JsValue::from_str("Direct TIFF decode: image dimensions overflow"))?;
    let bytes_per_sample = (bits_per_sample / 8) as usize;
    let expected_bytes = sample_count
        .checked_mul(bytes_per_sample)
        .ok_or_else(|| JsValue::from_str("Direct TIFF decode: raster byte count overflow"))?;

    let total_available = counts.iter().try_fold(0usize, |acc, &count| {
        acc.checked_add(count as usize)
    }).ok_or_else(|| JsValue::from_str("Direct TIFF decode: strip byte count overflow"))?;
    if total_available < expected_bytes {
        return Ok(None);
    }

    let mut raster = Vec::with_capacity(expected_bytes);
    for (&offset, &count) in offsets.iter().zip(counts.iter()) {
        if raster.len() >= expected_bytes {
            break;
        }
        let start = offset as usize;
        let count_usize = count as usize;
        let end = match start.checked_add(count_usize) {
            Some(value) => value,
            None => return Ok(None),
        };
        if end > data.len() {
            return Ok(None);
        }
        let remaining = expected_bytes - raster.len();
        let take = remaining.min(count_usize);
        raster.extend_from_slice(&data[start..start + take]);
    }
    if raster.len() != expected_bytes {
        return Ok(None);
    }

    let result = match (sample_format, bits_per_sample) {
        (1, 8) => DecodingResult::U8(raster),
        (1, 16) => {
            let values = raster.chunks_exact(2)
                .map(|b| {
                    if little_endian {
                        u16::from_le_bytes([b[0], b[1]])
                    } else {
                        u16::from_be_bytes([b[0], b[1]])
                    }
                })
                .collect();
            DecodingResult::U16(values)
        }
        (1, 32) => {
            let values = raster.chunks_exact(4)
                .map(|b| {
                    if little_endian {
                        u32::from_le_bytes([b[0], b[1], b[2], b[3]])
                    } else {
                        u32::from_be_bytes([b[0], b[1], b[2], b[3]])
                    }
                })
                .collect();
            DecodingResult::U32(values)
        }
        (2, 8) => DecodingResult::I8(raster.into_iter().map(|v| v as i8).collect()),
        (2, 16) => {
            let values = raster.chunks_exact(2)
                .map(|b| {
                    if little_endian {
                        i16::from_le_bytes([b[0], b[1]])
                    } else {
                        i16::from_be_bytes([b[0], b[1]])
                    }
                })
                .collect();
            DecodingResult::I16(values)
        }
        (2, 32) => {
            let values = raster.chunks_exact(4)
                .map(|b| {
                    if little_endian {
                        i32::from_le_bytes([b[0], b[1], b[2], b[3]])
                    } else {
                        i32::from_be_bytes([b[0], b[1], b[2], b[3]])
                    }
                })
                .collect();
            DecodingResult::I32(values)
        }
        (3, 32) => {
            let values = raster.chunks_exact(4)
                .map(|b| {
                    if little_endian {
                        f32::from_le_bytes([b[0], b[1], b[2], b[3]])
                    } else {
                        f32::from_be_bytes([b[0], b[1], b[2], b[3]])
                    }
                })
                .collect();
            DecodingResult::F32(values)
        }
        (3, 64) => {
            let values = raster.chunks_exact(8)
                .map(|b| {
                    if little_endian {
                        f64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
                    } else {
                        f64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
                    }
                })
                .collect();
            DecodingResult::F64(values)
        }
        _ => return Ok(None),
    };

    Ok(Some(result))
}

/// Decode a ZSTD-compressed TIFF (compression 50000) using the pure-Rust
/// ruzstd crate. We decompress each strip, concatenate the raster (still
/// predictor-encoded), rebuild it as a single-strip *uncompressed* TIFF that
/// keeps the predictor tag, and hand that back to the tiff crate so it performs
/// predictor un-application and type/endianness handling for us.
///
/// Tiled images and planar configuration 2 are not supported by this path.
fn decode_zstd(
    original: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
) -> Result<DecodingResult, JsValue> {
    use std::io::Read;
    use tiff::tags::Tag;

    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(JsValue::from_str("ZSTD: tiled TIFFs are not supported by the pure-Rust path"));
    }
    let planar = decoder.get_tag_u32(Tag::PlanarConfiguration).unwrap_or(1);
    if planar != 1 {
        return Err(JsValue::from_str("ZSTD: planar configuration 2 is not supported"));
    }

    let (width, height) = decoder.dimensions()
        .map_err(|e| JsValue::from_str(&format!("ZSTD: dimensions: {}", e)))?;
    let offsets = decoder.get_tag_u64_vec(Tag::StripOffsets)
        .map_err(|e| JsValue::from_str(&format!("ZSTD: StripOffsets: {}", e)))?;
    let counts = decoder.get_tag_u64_vec(Tag::StripByteCounts)
        .map_err(|e| JsValue::from_str(&format!("ZSTD: StripByteCounts: {}", e)))?;
    let spp = decoder.get_tag_u32(Tag::SamplesPerPixel).unwrap_or(1);
    let predictor = decoder.get_tag_u32(Tag::Predictor).unwrap_or(1);
    let photometric = decoder.get_tag_u32(Tag::PhotometricInterpretation).unwrap_or(1);
    let bits: Vec<u32> = decoder.get_tag_u64_vec(Tag::BitsPerSample)
        .map(|v| v.into_iter().map(|b| b as u32).collect())
        .unwrap_or_else(|_| vec![8; spp as usize]);
    let sample_format: Vec<u32> = decoder.get_tag_u64_vec(Tag::SampleFormat)
        .map(|v| v.into_iter().map(|s| s as u32).collect())
        .unwrap_or_else(|_| vec![1; spp as usize]);

    // Decompress every strip with pure-Rust ruzstd, concatenated in row order.
    let mut raster: Vec<u8> = Vec::new();
    for (off, cnt) in offsets.iter().zip(counts.iter()) {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > original.len() {
            return Err(JsValue::from_str("ZSTD: strip byte range out of bounds"));
        }
        let mut dec = ruzstd::decoding::StreamingDecoder::new(Cursor::new(&original[start..end]))
            .map_err(|e| JsValue::from_str(&format!("ZSTD: decoder init: {:?}", e)))?;
        dec.read_to_end(&mut raster)
            .map_err(|e| JsValue::from_str(&format!("ZSTD: decompress: {:?}", e)))?;
    }

    // Match the rebuilt TIFF's byte order to the original so multi-byte samples
    // are interpreted correctly.
    let little_endian = original.get(0..2) != Some(b"MM");
    let rebuilt = build_uncompressed_tiff(
        little_endian, width, height, spp, &bits, &sample_format, photometric, predictor, &raster,
    );
    let mut d = Decoder::new(Cursor::new(rebuilt.as_slice()))
        .map_err(|e| JsValue::from_str(&format!("ZSTD: rebuilt decoder: {}", e)))?;
    d.read_image()
        .map_err(|e| JsValue::from_str(&format!("ZSTD: rebuilt read_image: {}", e)))
}

/// Build a minimal single-strip, uncompressed classic TIFF wrapping `raster`,
/// preserving the tags the decoder needs (incl. the predictor, which the tiff
/// crate then un-applies). `raster` must be the full image in row order.
#[allow(clippy::too_many_arguments)]
fn build_uncompressed_tiff(
    le: bool,
    width: u32,
    height: u32,
    spp: u32,
    bits: &[u32],
    sample_format: &[u32],
    photometric: u32,
    predictor: u32,
    raster: &[u8],
) -> Vec<u8> {
    let u16b = |v: u16| if le { v.to_le_bytes() } else { v.to_be_bytes() };
    let u32b = |v: u32| if le { v.to_le_bytes() } else { v.to_be_bytes() };
    // SHORT (type 3) and LONG (type 4) tag values. Single SHORT values are
    // left-justified in the 4-byte value field; arrays are stored externally.
    let short_val = |v: u32| { let b = u16b(v as u16); [b[0], b[1], 0, 0] };
    let long_val = |v: u32| u32b(v);

    const N_TAGS: u16 = 12;
    let ifd_offset: u32 = 8;
    let ifd_size: u32 = 2 + (N_TAGS as u32) * 12 + 4;
    let after_ifd = ifd_offset + ifd_size;

    // BitsPerSample (258) / SampleFormat (339): a SHORT array fits inline in the
    // 4-byte value field when count <= 2; otherwise it is stored externally and
    // the value field holds the offset.
    let pack_inline = |vals: &[u32]| -> [u8; 4] {
        let mut f = [0u8; 4];
        for (i, &v) in vals.iter().enumerate().take(2) {
            let b = u16b(v as u16);
            f[2 * i] = b[0];
            f[2 * i + 1] = b[1];
        }
        f
    };
    let mut ext: Vec<u8> = Vec::new();
    let bits_field = if spp <= 2 {
        pack_inline(bits)
    } else {
        let off = after_ifd + ext.len() as u32;
        for &b in bits { ext.extend_from_slice(&u16b(b as u16)); }
        u32b(off)
    };
    let sf_field = if spp <= 2 {
        pack_inline(sample_format)
    } else {
        let off = after_ifd + ext.len() as u32;
        for &s in sample_format { ext.extend_from_slice(&u16b(s as u16)); }
        u32b(off)
    };
    let data_off = after_ifd + ext.len() as u32;

    let mut buf: Vec<u8> = Vec::with_capacity(data_off as usize + raster.len());
    buf.extend_from_slice(if le { b"II" } else { b"MM" });
    buf.extend_from_slice(&u16b(42));
    buf.extend_from_slice(&u32b(ifd_offset));
    buf.extend_from_slice(&u16b(N_TAGS));

    let put = |buf: &mut Vec<u8>, tag: u16, typ: u16, count: u32, valfield: [u8; 4]| {
        buf.extend_from_slice(&u16b(tag));
        buf.extend_from_slice(&u16b(typ));
        buf.extend_from_slice(&u32b(count));
        buf.extend_from_slice(&valfield);
    };

    // Tags must be in ascending order.
    put(&mut buf, 256, 4, 1, long_val(width));               // ImageWidth
    put(&mut buf, 257, 4, 1, long_val(height));              // ImageLength
    put(&mut buf, 258, 3, spp, bits_field);                  // BitsPerSample
    put(&mut buf, 259, 3, 1, short_val(1));                  // Compression = none
    put(&mut buf, 262, 3, 1, short_val(photometric));        // PhotometricInterpretation
    put(&mut buf, 273, 4, 1, long_val(data_off));            // StripOffsets
    put(&mut buf, 277, 3, 1, short_val(spp));                // SamplesPerPixel
    put(&mut buf, 278, 4, 1, long_val(height));              // RowsPerStrip
    put(&mut buf, 279, 4, 1, long_val(raster.len() as u32)); // StripByteCounts
    put(&mut buf, 284, 3, 1, short_val(1));                  // PlanarConfiguration = chunky
    put(&mut buf, 317, 3, 1, short_val(predictor));          // Predictor
    put(&mut buf, 339, 3, spp, sf_field);                    // SampleFormat

    buf.extend_from_slice(&u32b(0)); // next IFD offset
    buf.extend_from_slice(&ext);
    buf.extend_from_slice(raster);
    buf
}

/// Reconstruct a complete JPEG datastream from the optional shared JPEGTables
/// and one strip's image data (the TIFF Technote 2 abbreviated-stream layout):
/// a single SOI, then the tables, then the strip's frame.
fn build_jpeg(tables: Option<&[u8]>, strip: &[u8]) -> Vec<u8> {
    match tables {
        Some(t) => {
            let t = if t.ends_with(&[0xFF, 0xD9]) { &t[..t.len() - 2] } else { t };
            let s = if strip.starts_with(&[0xFF, 0xD8]) { &strip[2..] } else { strip };
            let mut out = Vec::with_capacity(t.len() + s.len());
            out.extend_from_slice(t);
            out.extend_from_slice(s);
            out
        }
        None => strip.to_vec(),
    }
}

/// Decode a JPEG-compressed YCbCr TIFF (compression 7, photometric 6) by
/// decoding each strip's JPEG directly with zune-jpeg. The tiff crate applies a
/// second YCbCr->RGB conversion on top of zune-jpeg's already-RGB output, which
/// tints the image; decoding the strips ourselves avoids that. Tiled images are
/// not handled here.
fn decode_jpeg_ycbcr(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
) -> Result<TiffResult, JsValue> {
    use tiff::tags::Tag;
    use zune_jpeg::JpegDecoder;

    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(JsValue::from_str("JPEG: tiled YCbCr JPEG is not supported by the direct path"));
    }
    let offsets = decoder.get_tag_u64_vec(Tag::StripOffsets)
        .map_err(|e| JsValue::from_str(&format!("JPEG: StripOffsets: {}", e)))?;
    let counts = decoder.get_tag_u64_vec(Tag::StripByteCounts)
        .map_err(|e| JsValue::from_str(&format!("JPEG: StripByteCounts: {}", e)))?;
    // JPEGTables (tag 347): optional abbreviated table stream shared by strips.
    let tables: Option<Vec<u8>> = decoder.get_tag_u8_vec(Tag::Unknown(347)).ok();

    let mut rgb: Vec<u8> = Vec::with_capacity((width as usize).saturating_mul(height as usize) * 3);
    let mut channels = 3u32;
    for (off, cnt) in offsets.iter().zip(counts.iter()) {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > data.len() {
            return Err(JsValue::from_str("JPEG: strip byte range out of bounds"));
        }
        let jpeg = build_jpeg(tables.as_deref(), &data[start..end]);
        let mut jd = JpegDecoder::new(Cursor::new(jpeg));
        let px = jd.decode()
            .map_err(|e| JsValue::from_str(&format!("JPEG decode failed: {:?}", e)))?;
        let info = jd.info()
            .ok_or_else(|| JsValue::from_str("JPEG: missing image info"))?;
        let pixels = (info.width as usize).saturating_mul(info.height as usize);
        if pixels == 0 {
            return Err(JsValue::from_str("JPEG: empty strip"));
        }
        channels = (px.len() / pixels) as u32;
        rgb.extend_from_slice(&px);
    }
    if channels != 1 && channels != 3 {
        return Err(JsValue::from_str("JPEG: unexpected channel count"));
    }

    let (min, max) = compute_stats_u8(&rgb);
    Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample: 8,
        sample_format: 1,
        compression: 7,
        predictor: 1,
        // Data is now decoded RGB (or grayscale); report it as such.
        photometric_interpretation: if channels == 3 { 2 } else { 1 },
        planar_configuration: 1,
        rows_per_strip: decoder.get_tag_u32(Tag::RowsPerStrip).unwrap_or(height),
        strip_count: counts.len() as u32,
        strip_byte_count_total: counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: counts.iter().copied().max().unwrap_or(0),
        tile_width: 0,
        tile_length: 0,
        tile_count: 0,
        direct_decode: false,
        data: rgb,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
    })
}

/// Expand MSB-first packed bilevel (1-bit) data to one byte per pixel.
///
/// Each row is padded to a byte boundary. Pixel polarity follows the TIFF
/// PhotometricInterpretation tag: 0 = WhiteIsZero, 1 = BlackIsZero.
fn unpack_bilevel(data: &[u8], width: u32, height: u32, photometric: u32) -> Vec<u8> {
    let width = width as usize;
    let height = height as usize;
    let row_bytes = (width + 7) / 8;
    let white_is_zero = photometric == 0;
    let mut out = Vec::with_capacity(width.saturating_mul(height));
    for y in 0..height {
        let row_start = y * row_bytes;
        for x in 0..width {
            let byte = data.get(row_start + x / 8).copied().unwrap_or(0);
            let bit = (byte >> (7 - (x % 8))) & 1;
            let white = if white_is_zero { bit == 0 } else { bit == 1 };
            out.push(if white { 255 } else { 0 });
        }
    }
    out
}

/// Rewrite the first IFD's PhotometricInterpretation (tag 262) from
/// RGBPalette (3) to BlackIsZero (1), in place, so the tiff crate will decode
/// the raw palette indices instead of refusing the image. Returns false (and
/// leaves the buffer untouched) for anything it does not understand, e.g.
/// BigTIFF.
fn patch_photometric_to_grayscale(buf: &mut [u8]) -> bool {
    if buf.len() < 8 {
        return false;
    }
    let le = match &buf[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return false,
    };
    let rd16 = |b: &[u8]| if le { u16::from_le_bytes([b[0], b[1]]) } else { u16::from_be_bytes([b[0], b[1]]) };
    let rd32 = |b: &[u8]| if le {
        u32::from_le_bytes([b[0], b[1], b[2], b[3]])
    } else {
        u32::from_be_bytes([b[0], b[1], b[2], b[3]])
    };
    // Only classic TIFF (magic 42) is handled; BigTIFF (43) is left to fall back.
    if rd16(&buf[2..4]) != 42 {
        return false;
    }
    let ifd = rd32(&buf[4..8]) as usize;
    if ifd + 2 > buf.len() {
        return false;
    }
    let count = rd16(&buf[ifd..ifd + 2]) as usize;
    for i in 0..count {
        let e = ifd + 2 + i * 12;
        if e + 12 > buf.len() {
            return false;
        }
        if rd16(&buf[e..e + 2]) == 262 {
            // SHORT value stored inline in the entry's value field.
            let one = if le { [1u8, 0u8] } else { [0u8, 1u8] };
            buf[e + 8] = one[0];
            buf[e + 9] = one[1];
            return true;
        }
    }
    false
}

/// Decode a palette (RGBPalette) TIFF by reading the raw indices and expanding
/// them through the ColorMap tag into interleaved 8-bit RGB.
fn decode_palette(data: &[u8], width: u32, height: u32) -> Result<TiffResult, JsValue> {
    use tiff::tags::Tag;

    // ColorMap (tag 320): 3 * 2^bits 16-bit entries, laid out as all reds, then
    // all greens, then all blues.
    let cmap = {
        let mut d = Decoder::new(Cursor::new(data))
            .map_err(|e| JsValue::from_str(&format!("Palette: decoder init: {}", e)))?;
        d.get_tag_u16_vec(Tag::Unknown(320))
            .map_err(|e| JsValue::from_str(&format!("Palette: missing ColorMap: {}", e)))?
    };
    if cmap.is_empty() || cmap.len() % 3 != 0 {
        return Err(JsValue::from_str("Palette: invalid ColorMap length"));
    }
    let n_colors = cmap.len() / 3;

    // Patch the photometric tag so the tiff crate decodes the indices for us,
    // reusing all of its compression / predictor / strip handling.
    let mut patched = data.to_vec();
    if !patch_photometric_to_grayscale(&mut patched) {
        return Err(JsValue::from_str("Palette: could not patch photometric tag"));
    }

    let mut d = Decoder::new(Cursor::new(patched.as_slice()))
        .map_err(|e| JsValue::from_str(&format!("Palette: patched decoder init: {}", e)))?;
    let compression = d.get_tag_u32(Tag::Compression).unwrap_or(1);
    let predictor = d.get_tag_u32(Tag::Predictor).unwrap_or(1);
    let planar = d.get_tag_u32(Tag::PlanarConfiguration).unwrap_or(1);
    let rows_per_strip = d.get_tag_u32(Tag::RowsPerStrip).unwrap_or(height);
    let strip_byte_counts = d.get_tag_u64_vec(Tag::StripByteCounts).unwrap_or_default();
    let tile_width = d.get_tag_u32(Tag::TileWidth).unwrap_or(0);
    let tile_length = d.get_tag_u32(Tag::TileLength).unwrap_or(0);
    let tile_count = d.get_tag_u64_vec(Tag::TileByteCounts)
        .map(|counts| counts.len() as u32)
        .unwrap_or(0);

    let indices: Vec<usize> = match d.read_image()
        .map_err(|e| JsValue::from_str(&format!("Palette: index decode failed: {}", e)))?
    {
        DecodingResult::U8(v) => v.iter().map(|&x| x as usize).collect(),
        DecodingResult::U16(v) => v.iter().map(|&x| x as usize).collect(),
        _ => return Err(JsValue::from_str("Palette: unexpected index sample type")),
    };

    // ColorMap entries are 16-bit; scale down to 8-bit per channel.
    let mut rgb = Vec::with_capacity(indices.len().saturating_mul(3));
    for &i in &indices {
        if i < n_colors {
            rgb.push((cmap[i] >> 8) as u8);
            rgb.push((cmap[n_colors + i] >> 8) as u8);
            rgb.push((cmap[2 * n_colors + i] >> 8) as u8);
        } else {
            rgb.extend_from_slice(&[0, 0, 0]);
        }
    }

    let (min, max) = compute_stats_u8(&rgb);
    Ok(TiffResult {
        width,
        height,
        channels: 3,
        bits_per_sample: 8,
        sample_format: 1,
        compression,
        predictor,
        photometric_interpretation: 2, // expanded to RGB
        planar_configuration: planar,
        rows_per_strip,
        strip_count: strip_byte_counts.len() as u32,
        strip_byte_count_total: strip_byte_counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: strip_byte_counts.iter().copied().max().unwrap_or(0),
        tile_width,
        tile_length,
        tile_count,
        direct_decode: false,
        data: rgb,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
    })
}

/// Decode a CCITT-fax-compressed TIFF (compression 2, 3 or 4) using hayro-ccitt.
///
/// CCITT data is bilevel; we expand it to one byte per pixel (0 = black,
/// 255 = white) and report it as an 8-bit grayscale image so it flows through
/// the same rendering path as any other integer TIFF.
#[allow(clippy::too_many_arguments)]
fn decode_ccitt(
    data: &[u8],
    width: u32,
    height: u32,
    compression: u32,
    predictor: u32,
    photometric_interpretation: u32,
    planar_configuration: u32,
    offsets: &[u64],
    counts: &[u64],
    fill_order: u32,
    t4_options: u32,
    rows_per_strip: u32,
) -> Result<TiffResult, JsValue> {
    use hayro_ccitt::{decode, DecodeSettings, DecoderContext, EncodingMode, Decoder as CcittDecoder};

    // Map the TIFF compression + T4Options to a hayro encoding mode.
    let two_dimensional = (t4_options & 0b1) != 0; // bit 0: 2D coding
    // Compression 2 (Modified Huffman) byte-aligns every row; for Group 3 this
    // is controlled by T4Options bit 2 (EncodedByteAlign).
    let byte_aligned = compression == 2 || (t4_options & 0b100) != 0;
    let encoding = match compression {
        4 => EncodingMode::Group4,
        3 if two_dimensional => EncodingMode::Group3_2D { k: u32::MAX },
        // Compression 2 (Modified Huffman) and 3 (Group 3, 1D).
        _ => EncodingMode::Group3_1D,
    };
    let end_of_line = matches!(encoding, EncodingMode::Group3_2D { .. });

    // hayro-ccitt emits a "white" pel for TIFF sample value 0 (the CCITT
    // convention). Map that to a display value through PhotometricInterpretation
    // exactly like unpack_bilevel does, so a CCITT image renders identically to
    // the same image stored uncompressed. (0 = WhiteIsZero, 1 = BlackIsZero.)
    let white_pel_value: u8 = if photometric_interpretation == 0 { 255 } else { 0 };
    let black_pel_value: u8 = 255 - white_pel_value;

    // hayro-ccitt streams decoded pixels through this collector.
    struct Collector {
        pixels: Vec<u8>,
        width: u32,
        cur_x: u32,
        white_value: u8,
        black_value: u8,
    }
    impl CcittDecoder for Collector {
        fn push_pixel(&mut self, white: bool) {
            if self.cur_x < self.width {
                self.pixels.push(if white { self.white_value } else { self.black_value });
                self.cur_x += 1;
            }
        }
        fn push_pixel_chunk(&mut self, white: bool, chunk_count: u32) {
            for _ in 0..(chunk_count * 8) {
                self.push_pixel(white);
            }
        }
        fn next_line(&mut self) {
            // Pad a short final run with the background (white) color so every
            // row is exactly `width` pixels.
            while self.cur_x < self.width {
                self.pixels.push(self.white_value);
                self.cur_x += 1;
            }
            self.cur_x = 0;
        }
    }

    let expected = (width as usize).saturating_mul(height as usize);
    let mut collector = Collector {
        pixels: Vec::with_capacity(expected),
        width,
        cur_x: 0,
        white_value: white_pel_value,
        black_value: black_pel_value,
    };

    // Each strip is an independent CCITT stream covering up to rows_per_strip
    // rows. Decode them one at a time (resetting the decoder per strip) and
    // accumulate the pixel rows, rather than concatenating the bitstreams.
    let rps = if rows_per_strip == 0 { height } else { rows_per_strip };
    for (i, (off, cnt)) in offsets.iter().zip(counts.iter()).enumerate() {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > data.len() {
            return Err(JsValue::from_str("CCITT: strip byte range out of bounds"));
        }
        let rows_in_strip = height.saturating_sub(i as u32 * rps).min(rps);
        if rows_in_strip == 0 {
            break;
        }
        // FillOrder 2 stores the least-significant bit first; hayro expects MSB.
        let mut strip = data[start..end].to_vec();
        if fill_order == 2 {
            for b in strip.iter_mut() {
                *b = b.reverse_bits();
            }
        }
        let settings = DecodeSettings {
            columns: width,
            rows: rows_in_strip,
            end_of_block: true,
            end_of_line,
            rows_are_byte_aligned: byte_aligned,
            encoding,
            invert_black: false,
        };
        let mut ctx = DecoderContext::new(settings);
        collector.cur_x = 0;
        decode(&strip, &mut collector, &mut ctx)
            .map_err(|e| JsValue::from_str(&format!("CCITT strip {} decode failed: {:?}", i, e)))?;
    }

    let mut pixels = collector.pixels;
    pixels.resize(expected, white_pel_value);

    let (min, max) = compute_stats_u8(&pixels);

    Ok(TiffResult {
        width,
        height,
        channels: 1,
        bits_per_sample: 8,
        sample_format: 1,
        compression,
        predictor,
        photometric_interpretation,
        planar_configuration,
        rows_per_strip,
        strip_count: counts.len() as u32,
        strip_byte_count_total: counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: counts.iter().copied().max().unwrap_or(0),
        tile_width: 0,
        tile_length: 0,
        tile_count: 0,
        direct_decode: false,
        data: pixels,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
    })
}

// SIMD-optimized conversion functions

/// Convert u16 slice to little-endian bytes using SIMD
#[inline]
fn convert_u16_to_bytes_simd(data: &[u16]) -> Vec<u8> {
    use wide::*;
    
    let mut bytes = Vec::with_capacity(data.len() * 2);
    
    // Process 8 u16s at a time (128-bit SIMD)
    let chunks = data.chunks_exact(8);
    let remainder = chunks.remainder();
    
    for chunk in chunks {
        let simd = u16x8::new([
            chunk[0], chunk[1], chunk[2], chunk[3],
            chunk[4], chunk[5], chunk[6], chunk[7]
        ]);
        
        let arr = simd.to_array();
        for val in arr {
            bytes.extend_from_slice(&val.to_le_bytes());
        }
    }
    
    // Handle remainder
    for &val in remainder {
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    
    bytes
}

// Statistics computation functions

fn compute_stats_u8(data: &[u8]) -> (u8, u8) {
    let mut min = u8::MAX;
    let mut max = u8::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_u16(data: &[u16]) -> (u16, u16) {
    let mut min = u16::MAX;
    let mut max = u16::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_u32(data: &[u32]) -> (u32, u32) {
    let mut min = u32::MAX;
    let mut max = u32::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_u64(data: &[u64]) -> (u64, u64) {
    let mut min = u64::MAX;
    let mut max = u64::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_i8(data: &[i8]) -> (i8, i8) {
    let mut min = i8::MAX;
    let mut max = i8::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_i16(data: &[i16]) -> (i16, i16) {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_i32(data: &[i32]) -> (i32, i32) {
    let mut min = i32::MAX;
    let mut max = i32::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_i64(data: &[i64]) -> (i64, i64) {
    let mut min = i64::MAX;
    let mut max = i64::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

fn compute_stats_f32(data: &[f32]) -> (f64, f64) {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &v in data {
        if !v.is_nan() && v.is_finite() {
            let v64 = v as f64;
            min = min.min(v64);
            max = max.max(v64);
        }
    }
    (min, max)
}

fn compute_stats_f64(data: &[f64]) -> (f64, f64) {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &v in data {
        if !v.is_nan() && v.is_finite() {
            min = min.min(v);
            max = max.max(v);
        }
    }
    (min, max)
}
