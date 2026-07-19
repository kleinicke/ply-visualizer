//! Authoritative camera projection and unprojection kernels.
//!
//! Coefficient layouts are deliberately model-specific and exact:
//! - `pinhole-opencv`: `[k1, k2, p1, p2, k3]`
//! - `fisheye-opencv`: `[k1, k2, k3, k4]`
//! - `fisheye-kb3`: `[k0, k1, k2, k3]`
//! - `fisheye624`: `[k0..k5, p0, p1, s0..s3]`

use std::f64::consts::PI;

const EPS: f64 = 1e-12;
const RESIDUAL_TOLERANCE: f64 = 1e-10;
const MAX_ITERATIONS: u32 = 30;
const MAX_THETA: f64 = PI - 1e-7;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CameraModel {
    PinholeIdeal,
    PinholeOpenCv,
    FisheyeEquidistant,
    FisheyeOpenCv,
    FisheyeKb3,
    Fisheye624,
}

impl CameraModel {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "pinhole-ideal" => Ok(Self::PinholeIdeal),
            "pinhole-opencv" => Ok(Self::PinholeOpenCv),
            "fisheye-equidistant" => Ok(Self::FisheyeEquidistant),
            "fisheye-opencv" => Ok(Self::FisheyeOpenCv),
            "fisheye-kb3" => Ok(Self::FisheyeKb3),
            "fisheye624" => Ok(Self::Fisheye624),
            "fisheye-kannala-brandt" => Err(
                "Legacy fisheye-kannala-brandt is ambiguous; select fisheye-kb3 and provide [k0,k1,k2,k3]"
                    .to_owned(),
            ),
            _ => Err(format!("Unsupported camera model: {value}")),
        }
    }

    pub fn coefficient_count(self) -> usize {
        match self {
            Self::PinholeIdeal | Self::FisheyeEquidistant => 0,
            Self::PinholeOpenCv => 5,
            Self::FisheyeOpenCv | Self::FisheyeKb3 => 4,
            Self::Fisheye624 => 12,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Intrinsics {
    pub fx: f64,
    pub fy: f64,
    pub cx: f64,
    pub cy: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct SolveResult<T> {
    pub value: T,
    pub converged: bool,
    pub iterations: u32,
}

pub fn validate(
    model: CameraModel,
    intrinsics: Intrinsics,
    coefficients: &[f64],
) -> Result<(), String> {
    if !intrinsics.fx.is_finite()
        || !intrinsics.fy.is_finite()
        || intrinsics.fx <= 0.0
        || intrinsics.fy <= 0.0
    {
        return Err("Focal lengths must be finite and positive".to_owned());
    }
    if !intrinsics.cx.is_finite() || !intrinsics.cy.is_finite() {
        return Err("Principal point must be finite".to_owned());
    }
    let expected = model.coefficient_count();
    if coefficients.len() != expected {
        return Err(format!(
            "{} requires exactly {expected} coefficients, got {}",
            model_name(model),
            coefficients.len()
        ));
    }
    if coefficients.iter().any(|v| !v.is_finite()) {
        return Err("Camera coefficients must be finite".to_owned());
    }
    Ok(())
}

fn model_name(model: CameraModel) -> &'static str {
    match model {
        CameraModel::PinholeIdeal => "pinhole-ideal",
        CameraModel::PinholeOpenCv => "pinhole-opencv",
        CameraModel::FisheyeEquidistant => "fisheye-equidistant",
        CameraModel::FisheyeOpenCv => "fisheye-opencv",
        CameraModel::FisheyeKb3 => "fisheye-kb3",
        CameraModel::Fisheye624 => "fisheye624",
    }
}

pub fn project(
    model: CameraModel,
    intrinsics: Intrinsics,
    coefficients: &[f64],
    ray: [f64; 3],
) -> SolveResult<[f64; 2]> {
    let [x, y, z] = ray;
    if !x.is_finite() || !y.is_finite() || !z.is_finite() {
        return invalid2();
    }

    let normalized = match model {
        CameraModel::PinholeIdeal | CameraModel::PinholeOpenCv => {
            if z <= EPS {
                return invalid2();
            }
            [x / z, y / z]
        }
        _ => {
            let rho = x.hypot(y);
            let theta = rho.atan2(z);
            if theta < 0.0 || theta >= MAX_THETA {
                return invalid2();
            }
            let (cos_phi, sin_phi) = if rho <= EPS {
                (1.0, 0.0)
            } else {
                (x / rho, y / rho)
            };
            let radius = match model {
                CameraModel::FisheyeEquidistant => theta,
                CameraModel::FisheyeOpenCv | CameraModel::FisheyeKb3 | CameraModel::Fisheye624 => {
                    radial(theta, coefficients, model)
                }
                _ => unreachable!(),
            };
            [radius * cos_phi, radius * sin_phi]
        }
    };

    let distorted = match model {
        CameraModel::PinholeOpenCv => distort_opencv_pinhole(normalized, coefficients),
        CameraModel::Fisheye624 => distort_fisheye624(normalized, coefficients),
        _ => normalized,
    };
    let pixel = [
        intrinsics.fx * distorted[0] + intrinsics.cx,
        intrinsics.fy * distorted[1] + intrinsics.cy,
    ];
    if pixel.iter().all(|v| v.is_finite()) {
        SolveResult {
            value: pixel,
            converged: true,
            iterations: 0,
        }
    } else {
        invalid2()
    }
}

pub fn unproject(
    model: CameraModel,
    intrinsics: Intrinsics,
    coefficients: &[f64],
    pixel: [f64; 2],
) -> SolveResult<[f64; 3]> {
    if pixel.iter().any(|v| !v.is_finite()) {
        return invalid3();
    }
    let observed = [
        (pixel[0] - intrinsics.cx) / intrinsics.fx,
        (pixel[1] - intrinsics.cy) / intrinsics.fy,
    ];

    let undistorted = match model {
        CameraModel::PinholeOpenCv => invert_2d(observed, |point| {
            distortion_with_jacobian_opencv(point, coefficients)
        }),
        CameraModel::Fisheye624 => invert_2d(observed, |point| {
            distortion_with_jacobian_fisheye624(point, coefficients)
        }),
        _ => SolveResult {
            value: observed,
            converged: true,
            iterations: 0,
        },
    };
    if !undistorted.converged {
        return SolveResult {
            value: [f64::NAN; 3],
            converged: false,
            iterations: undistorted.iterations,
        };
    }

    match model {
        CameraModel::PinholeIdeal | CameraModel::PinholeOpenCv => {
            let [x, y] = undistorted.value;
            let inv_norm = 1.0 / (x * x + y * y + 1.0).sqrt();
            SolveResult {
                value: [x * inv_norm, y * inv_norm, inv_norm],
                converged: true,
                iterations: undistorted.iterations,
            }
        }
        _ => {
            let [x, y] = undistorted.value;
            let observed_radius = x.hypot(y);
            let radial_result = match model {
                CameraModel::FisheyeEquidistant => SolveResult {
                    value: observed_radius,
                    converged: observed_radius < MAX_THETA,
                    iterations: 0,
                },
                CameraModel::FisheyeOpenCv | CameraModel::FisheyeKb3 | CameraModel::Fisheye624 => {
                    invert_radial(observed_radius, coefficients, model)
                }
                _ => unreachable!(),
            };
            if !radial_result.converged || radial_result.value >= MAX_THETA {
                return SolveResult {
                    value: [f64::NAN; 3],
                    converged: false,
                    iterations: undistorted.iterations + radial_result.iterations,
                };
            }
            let theta = radial_result.value;
            let scale = if observed_radius <= EPS {
                0.0
            } else {
                theta.sin() / observed_radius
            };
            SolveResult {
                value: [x * scale, y * scale, theta.cos()],
                converged: true,
                iterations: undistorted.iterations + radial_result.iterations,
            }
        }
    }
}

fn radial(theta: f64, coefficients: &[f64], model: CameraModel) -> f64 {
    let theta2 = theta * theta;
    match model {
        CameraModel::FisheyeOpenCv | CameraModel::FisheyeKb3 => {
            theta
                * (1.0
                    + theta2
                        * (coefficients[0]
                            + theta2
                                * (coefficients[1]
                                    + theta2 * (coefficients[2] + theta2 * coefficients[3]))))
        }
        CameraModel::Fisheye624 => {
            theta
                * (1.0
                    + theta2
                        * (coefficients[0]
                            + theta2
                                * (coefficients[1]
                                    + theta2
                                        * (coefficients[2]
                                            + theta2
                                                * (coefficients[3]
                                                    + theta2
                                                        * (coefficients[4]
                                                            + theta2 * coefficients[5]))))))
        }
        _ => theta,
    }
}

fn radial_derivative(theta: f64, coefficients: &[f64], model: CameraModel) -> f64 {
    let theta2 = theta * theta;
    let count = if model == CameraModel::Fisheye624 {
        6
    } else {
        4
    };
    let mut derivative = 1.0;
    let mut power = theta2;
    for (index, coefficient) in coefficients.iter().take(count).enumerate() {
        derivative += (2 * index + 3) as f64 * coefficient * power;
        power *= theta2;
    }
    derivative
}

fn invert_radial(target: f64, coefficients: &[f64], model: CameraModel) -> SolveResult<f64> {
    if target <= EPS {
        return SolveResult {
            value: 0.0,
            converged: true,
            iterations: 0,
        };
    }
    let mut low = 0.0;
    // Only the first monotonic lobe is a valid inverse domain. Distorted
    // polynomials commonly turn over before pi even though the calibrated
    // image lies comfortably inside that limit.
    let mut high = MAX_THETA;
    let mut previous = 0.0;
    for step in 1..=512 {
        let theta = MAX_THETA * step as f64 / 512.0;
        if radial_derivative(theta, coefficients, model) <= EPS {
            high = previous;
            break;
        }
        previous = theta;
    }
    if high <= EPS
        || radial(high, coefficients, model) < target
        || radial_derivative(low, coefficients, model) <= 0.0
    {
        return SolveResult {
            value: f64::NAN,
            converged: false,
            iterations: 0,
        };
    }
    let mut theta = target.min(high * 0.5);
    for iteration in 1..=MAX_ITERATIONS {
        let residual = radial(theta, coefficients, model) - target;
        if residual.abs() <= RESIDUAL_TOLERANCE * (1.0 + target) {
            return SolveResult {
                value: theta,
                converged: true,
                iterations: iteration,
            };
        }
        if residual > 0.0 {
            high = theta;
        } else {
            low = theta;
        }
        let derivative = radial_derivative(theta, coefficients, model);
        let candidate = theta - residual / derivative;
        theta = if derivative > EPS && candidate > low && candidate < high && candidate.is_finite()
        {
            candidate
        } else {
            0.5 * (low + high)
        };
    }
    SolveResult {
        value: theta,
        converged: false,
        iterations: MAX_ITERATIONS,
    }
}

fn distort_opencv_pinhole(point: [f64; 2], coefficients: &[f64]) -> [f64; 2] {
    distortion_with_jacobian_opencv(point, coefficients).0
}

fn distortion_with_jacobian_opencv(point: [f64; 2], c: &[f64]) -> ([f64; 2], [[f64; 2]; 2]) {
    let [x, y] = point;
    let (k1, k2, p1, p2, k3) = (c[0], c[1], c[2], c[3], c[4]);
    let r2 = x * x + y * y;
    let r4 = r2 * r2;
    let radial = 1.0 + k1 * r2 + k2 * r4 + k3 * r4 * r2;
    let radial_slope = k1 + 2.0 * k2 * r2 + 3.0 * k3 * r4;
    let drdx = 2.0 * x * radial_slope;
    let drdy = 2.0 * y * radial_slope;
    let value = [
        x * radial + 2.0 * p1 * x * y + p2 * (r2 + 2.0 * x * x),
        y * radial + p1 * (r2 + 2.0 * y * y) + 2.0 * p2 * x * y,
    ];
    let jacobian = [
        [
            radial + x * drdx + 2.0 * p1 * y + 6.0 * p2 * x,
            x * drdy + 2.0 * p1 * x + 2.0 * p2 * y,
        ],
        [
            y * drdx + 2.0 * p1 * x + 2.0 * p2 * y,
            radial + y * drdy + 6.0 * p1 * y + 2.0 * p2 * x,
        ],
    ];
    (value, jacobian)
}

fn distort_fisheye624(point: [f64; 2], coefficients: &[f64]) -> [f64; 2] {
    distortion_with_jacobian_fisheye624(point, coefficients).0
}

fn distortion_with_jacobian_fisheye624(point: [f64; 2], c: &[f64]) -> ([f64; 2], [[f64; 2]; 2]) {
    let [x, y] = point;
    let (p0, p1, s0, s1, s2, s3) = (c[6], c[7], c[8], c[9], c[10], c[11]);
    let r2 = x * x + y * y;
    let r4 = r2 * r2;
    let value = [
        x + p0 * (2.0 * x * x + r2) + 2.0 * p1 * x * y + s0 * r2 + s1 * r4,
        y + p1 * (2.0 * y * y + r2) + 2.0 * p0 * x * y + s2 * r2 + s3 * r4,
    ];
    let common_x = 2.0 * s0 * x + 4.0 * s1 * x * r2;
    let common_y = 2.0 * s0 * y + 4.0 * s1 * y * r2;
    let common2_x = 2.0 * s2 * x + 4.0 * s3 * x * r2;
    let common2_y = 2.0 * s2 * y + 4.0 * s3 * y * r2;
    let jacobian = [
        [
            1.0 + 6.0 * p0 * x + 2.0 * p1 * y + common_x,
            2.0 * p0 * y + 2.0 * p1 * x + common_y,
        ],
        [
            2.0 * p1 * x + 2.0 * p0 * y + common2_x,
            1.0 + 6.0 * p1 * y + 2.0 * p0 * x + common2_y,
        ],
    ];
    (value, jacobian)
}

fn invert_2d<F>(target: [f64; 2], distortion: F) -> SolveResult<[f64; 2]>
where
    F: Fn([f64; 2]) -> ([f64; 2], [[f64; 2]; 2]),
{
    let mut estimate = target;
    for iteration in 1..=MAX_ITERATIONS {
        let (value, jacobian) = distortion(estimate);
        let residual = [value[0] - target[0], value[1] - target[1]];
        if residual[0].hypot(residual[1]) <= RESIDUAL_TOLERANCE * (1.0 + target[0].hypot(target[1]))
        {
            return SolveResult {
                value: estimate,
                converged: true,
                iterations: iteration,
            };
        }
        let det = jacobian[0][0] * jacobian[1][1] - jacobian[0][1] * jacobian[1][0];
        if !det.is_finite() || det.abs() <= EPS {
            return SolveResult {
                value: [f64::NAN; 2],
                converged: false,
                iterations: iteration,
            };
        }
        let dx = (jacobian[1][1] * residual[0] - jacobian[0][1] * residual[1]) / det;
        let dy = (-jacobian[1][0] * residual[0] + jacobian[0][0] * residual[1]) / det;
        let step_norm = dx.hypot(dy);
        let damping = if step_norm > 1.0 {
            1.0 / step_norm
        } else {
            1.0
        };
        estimate[0] -= damping * dx;
        estimate[1] -= damping * dy;
        if estimate.iter().any(|v| !v.is_finite() || v.abs() > 1e6) {
            return SolveResult {
                value: [f64::NAN; 2],
                converged: false,
                iterations: iteration,
            };
        }
    }
    SolveResult {
        value: estimate,
        converged: false,
        iterations: MAX_ITERATIONS,
    }
}

fn invalid2() -> SolveResult<[f64; 2]> {
    SolveResult {
        value: [f64::NAN; 2],
        converged: false,
        iterations: 0,
    }
}

fn invalid3() -> SolveResult<[f64; 3]> {
    SolveResult {
        value: [f64::NAN; 3],
        converged: false,
        iterations: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intrinsics() -> Intrinsics {
        Intrinsics {
            fx: 510.0,
            fy: 470.0,
            cx: 320.0,
            cy: 240.0,
        }
    }

    fn round_trip(model: CameraModel, coefficients: &[f64], ray: [f64; 3], tolerance: f64) {
        validate(model, intrinsics(), coefficients).unwrap();
        let pixel = project(model, intrinsics(), coefficients, ray);
        assert!(pixel.converged, "projection failed: {pixel:?}");
        let recovered = unproject(model, intrinsics(), coefficients, pixel.value);
        assert!(recovered.converged, "unprojection failed: {recovered:?}");
        let norm = (ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2]).sqrt();
        for index in 0..3 {
            assert!(
                (recovered.value[index] - ray[index] / norm).abs() < tolerance,
                "{recovered:?}"
            );
        }
    }

    #[test]
    fn round_trips_all_models_with_anisotropic_intrinsics() {
        round_trip(CameraModel::PinholeIdeal, &[], [0.4, -0.2, 1.0], 1e-10);
        round_trip(
            CameraModel::PinholeOpenCv,
            &[0.2, -0.08, 0.01, -0.015, 0.02],
            [0.55, -0.35, 1.0],
            1e-8,
        );
        round_trip(
            CameraModel::FisheyeEquidistant,
            &[],
            [0.7, -0.25, 0.8],
            1e-10,
        );
        round_trip(
            CameraModel::FisheyeOpenCv,
            &[0.08, -0.02, 0.004, -0.0005],
            [0.8, 0.35, 0.55],
            1e-8,
        );
        round_trip(
            CameraModel::FisheyeKb3,
            &[0.09, -0.025, 0.004, -0.0004],
            [-0.8, 0.4, 0.6],
            1e-8,
        );
        round_trip(
            CameraModel::Fisheye624,
            &[
                0.08, -0.02, 0.004, -0.0005, 0.00004, -0.000002, 0.002, -0.003, 0.001, -0.0002,
                -0.0007, 0.0001,
            ],
            [0.75, -0.45, 0.7],
            1e-8,
        );
    }

    #[test]
    fn rejects_wrong_layout_and_out_of_domain_values() {
        assert!(validate(CameraModel::FisheyeKb3, intrinsics(), &[0.0; 5]).is_err());
        assert!(CameraModel::parse("fisheye-kannala-brandt").is_err());
        assert!(
            !project(
                CameraModel::PinholeIdeal,
                intrinsics(),
                &[],
                [0.0, 0.0, -1.0]
            )
            .converged
        );
        assert!(
            !unproject(
                CameraModel::FisheyeEquidistant,
                intrinsics(),
                &[],
                [1e9, 1e9]
            )
            .converged
        );
    }

    #[test]
    fn reports_non_convergence_for_non_invertible_distortion() {
        let result = unproject(
            CameraModel::PinholeOpenCv,
            intrinsics(),
            &[-1.0, 0.0, 0.0, 0.0, 0.0],
            [1000.0, 900.0],
        );
        assert!(!result.converged);
    }
}
