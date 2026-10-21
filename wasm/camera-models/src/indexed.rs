use crate::{
    project, project_opencv_pinhole, validate, CameraModel, Intrinsics, OpenCvPinhole, SolveResult,
};

/// Project selected 3D points after applying a row-major 4x4 transform.
///
/// `positions` contains interleaved xyz values and `indices` selects the
/// points to project. The result contains interleaved uv values in index order;
/// rejected points are returned as NaN pairs. `max_normalized_x/y` provide an
/// optional pre-distortion calibration-domain guard (use infinity to disable).
#[allow(clippy::too_many_arguments)]
pub fn project_points_indexed(
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
) -> Result<Vec<f32>, String> {
    let model = CameraModel::parse(camera_model)?;
    let intrinsics = Intrinsics { fx, fy, cx, cy };
    validate(model, intrinsics, coefficients)?;
    if !positions.len().is_multiple_of(3) {
        return Err("positions must contain interleaved xyz values".to_owned());
    }
    if transform.len() != 16 || transform.iter().any(|value| !value.is_finite()) {
        return Err("transform must contain 16 finite row-major values".to_owned());
    }
    if max_normalized_x <= 0.0 || max_normalized_y <= 0.0 {
        return Err("normalized projection limits must be positive".to_owned());
    }

    let opencv = (model == CameraModel::PinholeOpenCv).then(|| OpenCvPinhole::new(coefficients));
    let mut pixels = Vec::with_capacity(indices.len() * 2);
    for &index in indices {
        let offset = index as usize * 3;
        if offset + 2 >= positions.len() {
            return Err("point index is outside positions".to_owned());
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
                Some(distortion) => project_opencv_pinhole(intrinsics, distortion, camera_ray),
                None => project(model, intrinsics, coefficients, camera_ray),
            }
        } else {
            SolveResult {
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
