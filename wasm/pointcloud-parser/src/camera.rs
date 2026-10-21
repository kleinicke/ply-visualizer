use wasm_bindgen::prelude::*;

/// Project selected 3D points after applying a row-major 4x4 transform.
///
/// `positions` contains interleaved xyz values and `indices` selects the
/// points to project. The result contains interleaved uv values in index order;
/// rejected points are returned as NaN pairs. `max_normalized_x/y` provide an
/// optional pre-distortion calibration-domain guard (use infinity to disable).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)] // Preserve the JavaScript calling convention.
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
    camera_models::project_points_indexed(
        camera_model,
        fx,
        fy,
        cx,
        cy,
        coefficients,
        positions,
        indices,
        transform,
        max_normalized_x,
        max_normalized_y,
    )
    .map_err(|error| JsValue::from_str(&error))
}
