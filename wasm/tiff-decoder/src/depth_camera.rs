use std::mem;

use camera_models::{CameraModel, Intrinsics};
use wasm_bindgen::prelude::*;

// Depth / camera-model exports (ply-visualizer only)
// ---------------------------------------------------------------------------

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
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn unit(&self) -> String {
        self.unit.clone()
    }

    #[wasm_bindgen]
    pub fn take_data(&mut self) -> Vec<f32> {
        mem::take(&mut self.data)
    }
}

#[wasm_bindgen]
impl DepthProjectResult {
    #[wasm_bindgen(getter)]
    pub fn point_count(&self) -> u32 {
        self.point_count
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn has_pixel_coords(&self) -> bool {
        self.has_pixel_coords
    }

    #[wasm_bindgen(getter)]
    pub fn rejected_count(&self) -> u32 {
        self.rejected_count
    }

    #[wasm_bindgen(getter)]
    pub fn non_converged_count(&self) -> u32 {
        self.non_converged_count
    }

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
        if unit == "millimeter" {
            0.001 * scale
        } else {
            scale
        }
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
            *v = if d > eps {
                (fx * baseline) / d
            } else {
                f32::NAN
            };
        }
        normalized_kind = "depth".to_string();
        normalized_unit = "meter".to_string();
    } else if kind == "inverse_depth" {
        let inverse_scale = if unit == "millimeter" {
            0.001 * scale
        } else {
            scale
        };
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

/// One horizontal band of an image, projected with the *whole* image's depth
/// range and row offset.
///
/// Splitting the unprojection across workers is only sound if every band agrees
/// on two things it cannot see from its own rows: the grey ramp's endpoints
/// (which are logarithmic over the full depth range, so a per-band range shows
/// up as banding), and where the band sits in the image (`row_offset`, which
/// the returned pixel coordinates need — the intrinsics are pre-shifted by the
/// caller so the rays themselves are already correct).
///
/// `depth_min`/`depth_max` come from one pass over the full image; pass
/// non-finite values to fall back to this band's own range.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn project_depth_band(
    data: &[f32],
    width: u32,
    height: u32,
    row_offset: u32,
    depth_min: f32,
    depth_max: f32,
    kind: &str,
    camera_model: &str,
    convention: &str,
    fx: f32,
    fy: f32,
    cx: f32,
    cy: f32,
    coefficients: &[f64],
) -> Result<DepthProjectResult, JsValue> {
    project_depth_impl(
        data,
        width,
        height,
        row_offset,
        Some((depth_min, depth_max)),
        kind,
        camera_model,
        convention,
        fx,
        fy,
        cx,
        cy,
        coefficients,
    )
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
    project_depth_impl(
        data,
        width,
        height,
        0,
        None,
        kind,
        camera_model,
        convention,
        fx,
        fy,
        cx,
        cy,
        coefficients,
    )
}

#[allow(clippy::too_many_arguments)]
fn project_depth_impl(
    data: &[f32],
    width: u32,
    height: u32,
    row_offset: u32,
    depth_range: Option<(f32, f32)>,
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
    let opencv = (model == CameraModel::PinholeOpenCv)
        .then(|| camera_models::OpenCvPinhole::new(coefficients));
    // The radial inversion's valid-domain scan depends on the calibration, not
    // on the pixel, so it is built once for the whole image instead of once per
    // pixel: 512 polynomial evaluations that used to repeat 26 million times on
    // a single 5120x5120 frame. Measured 20x on the kernel, results identical.
    let radial_domain = camera_models::RadialDomain::new(model, coefficients);

    let mut valid_count = 0usize;
    let mut min_depth = f32::INFINITY;
    let mut max_depth = f32::NEG_INFINITY;
    for &v in data.iter().take(expected) {
        if v.is_finite() && v > 0.0 {
            valid_count += 1;
            if v < min_depth {
                min_depth = v;
            }
            if v > max_depth {
                max_depth = v;
            }
        }
    }

    let mut positions = Vec::with_capacity(valid_count * 3);
    let mut colors = Vec::with_capacity(valid_count * 3);
    let needs_pixel_coords = matches!(
        model,
        CameraModel::PinholeOpenCv
            | CameraModel::FisheyeOpenCv
            | CameraModel::FisheyeKb3
            | CameraModel::Fisheye624
    );
    let mut pixel_coords = if needs_pixel_coords {
        Vec::with_capacity(valid_count * 2)
    } else {
        Vec::new()
    };

    // A supplied range is the whole image's; without one this call is the whole
    // image and its own range is the right one.
    if let Some((supplied_min, supplied_max)) = depth_range {
        if supplied_min.is_finite() && supplied_max.is_finite() && supplied_max > 0.0 {
            min_depth = supplied_min;
            max_depth = supplied_max;
        }
    }

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
            let pixel = [u as f64, v as f64];
            let ray = match &opencv {
                Some(distortion) => {
                    camera_models::unproject_opencv_pinhole(intrinsics, distortion, pixel)
                }
                None => camera_models::unproject_with_domain(
                    model,
                    intrinsics,
                    coefficients,
                    &radial_domain,
                    pixel,
                ),
            };
            if !ray.converged || ray.value.iter().any(|value| !value.is_finite()) {
                rejected_count += 1;
                if ray.iterations > 0 {
                    non_converged_count += 1;
                }
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

            let s = if denom > 0.0 {
                (depth_value.ln() - log_min) * inv_denom
            } else {
                1.0
            };
            let gray = (51.5 + 204.0 * s) as u8;
            colors.extend_from_slice(&[gray, gray, gray]);
            if needs_pixel_coords {
                pixel_coords.push(u.min(u16::MAX as usize) as u16);
                pixel_coords.push((v + row_offset as usize).min(u16::MAX as usize) as u16);
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
        if result.converged && result.value.iter().all(|value| value.is_finite()) {
            1.0
        } else {
            0.0
        },
        if result.converged { 1.0 } else { 0.0 },
        result.iterations as f64,
        result.value[0],
        result.value[1],
    ])
}

/// Project selected 3D points after applying a row-major 4x4 transform.
///
/// `positions` contains interleaved xyz values and `indices` selects the
/// points to project. The result contains interleaved uv values in index order;
/// rejected points are returned as NaN pairs. `max_normalized_x/y` provide an
/// optional pre-distortion calibration-domain guard (use infinity to disable).
#[wasm_bindgen]
pub fn camera_project_points_indexed(
    camera_model: &str,
    fx: f64,
    fy: f64,
    cx: f64,
    cy: f64,
    coefficients: &[f64],
    positions: &[f32],
    indices: &[u32],
    transform: &[f64],
    max_normalized_x: f64,
    max_normalized_y: f64,
) -> Result<Vec<f32>, JsValue> {
    let model = CameraModel::parse(camera_model).map_err(|error| JsValue::from_str(&error))?;
    let intrinsics = Intrinsics { fx, fy, cx, cy };
    camera_models::validate(model, intrinsics, coefficients)
        .map_err(|error| JsValue::from_str(&error))?;
    if positions.len() % 3 != 0 {
        return Err(JsValue::from_str(
            "positions must contain interleaved xyz values",
        ));
    }
    if transform.len() != 16 || transform.iter().any(|value| !value.is_finite()) {
        return Err(JsValue::from_str(
            "transform must contain 16 finite row-major values",
        ));
    }
    if max_normalized_x <= 0.0 || max_normalized_y <= 0.0 {
        return Err(JsValue::from_str(
            "normalized projection limits must be positive",
        ));
    }

    let opencv = (model == CameraModel::PinholeOpenCv)
        .then(|| camera_models::OpenCvPinhole::new(coefficients));
    let mut pixels = Vec::with_capacity(indices.len() * 2);
    for &index in indices {
        let offset = index as usize * 3;
        if offset + 2 >= positions.len() {
            return Err(JsValue::from_str("point index is outside positions"));
        }
        let x = positions[offset] as f64;
        let y = positions[offset + 1] as f64;
        let z = positions[offset + 2] as f64;
        let camera_ray = [
            transform[0] * x + transform[1] * y + transform[2] * z + transform[3],
            transform[4] * x + transform[5] * y + transform[6] * z + transform[7],
            transform[8] * x + transform[9] * y + transform[10] * z + transform[11],
        ];
        let normalized_valid = if matches!(
            model,
            CameraModel::PinholeIdeal | CameraModel::PinholeOpenCv | CameraModel::E57Pinhole
        ) {
            let depth = if model == CameraModel::E57Pinhole {
                -camera_ray[2]
            } else {
                camera_ray[2]
            };
            depth > 0.0
                && (camera_ray[0] / depth).abs() <= max_normalized_x
                && (camera_ray[1] / depth).abs() <= max_normalized_y
        } else {
            true
        };
        let projected = if normalized_valid {
            match &opencv {
                Some(distortion) => {
                    camera_models::project_opencv_pinhole(intrinsics, distortion, camera_ray)
                }
                None => camera_models::project(model, intrinsics, coefficients, camera_ray),
            }
        } else {
            camera_models::SolveResult {
                value: [f64::NAN; 2],
                converged: false,
                iterations: 0,
            }
        };
        if projected.converged {
            pixels.extend_from_slice(&[projected.value[0] as f32, projected.value[1] as f32]);
        } else {
            pixels.extend_from_slice(&[f32::NAN; 2]);
        }
    }
    Ok(pixels)
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
        if result.converged && result.value.iter().all(|value| value.is_finite()) {
            1.0
        } else {
            0.0
        },
        if result.converged { 1.0 } else { 0.0 },
        result.iterations as f64,
        result.value[0],
        result.value[1],
        result.value[2],
    ])
}

