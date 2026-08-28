//! Times unprojection with the radial domain built per call against built once.
//!
//! The browser is too noisy to resolve this: the same configuration varied by
//! 10% between runs. Here the only difference is where the domain scan happens.

use camera_models::{unproject, unproject_with_domain, CameraModel, Intrinsics, RadialDomain};
use std::time::Instant;

fn main() {
    let intrinsics = Intrinsics {
        fx: 500.0,
        fy: 500.0,
        cx: 511.5,
        cy: 511.5,
    };
    let cases: Vec<(&str, CameraModel, Vec<f64>)> = vec![
        (
            "kb3 (4 radial)",
            CameraModel::FisheyeKb3,
            vec![-0.05, 0.01, 0.001, 0.0001],
        ),
        (
            "fisheye624 (4 radial + 8 zeros)",
            CameraModel::Fisheye624,
            vec![
                -0.05, 0.01, 0.001, 0.0001, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            ],
        ),
        (
            "fisheye624 (prism terms)",
            CameraModel::Fisheye624,
            vec![
                -0.05, 0.01, 0.001, 0.0001, 0.0, 0.0, 1e-3, 1e-3, 1e-4, 1e-4, 1e-4, 1e-4,
            ],
        ),
    ];

    let side = 1024;
    for (name, model, coefficients) in cases {
        let mut checksum = 0.0f64;
        let start = Instant::now();
        for v in 0..side {
            for u in 0..side {
                let r = unproject(model, intrinsics, &coefficients, [u as f64, v as f64]);
                if r.converged {
                    checksum += r.value[2];
                }
            }
        }
        let per_call = start.elapsed().as_secs_f64() * 1000.0;

        let domain = RadialDomain::new(model, &coefficients);
        let mut checksum2 = 0.0f64;
        let start = Instant::now();
        for v in 0..side {
            for u in 0..side {
                let r = unproject_with_domain(
                    model,
                    intrinsics,
                    &coefficients,
                    &domain,
                    [u as f64, v as f64],
                );
                if r.converged {
                    checksum2 += r.value[2];
                }
            }
        }
        let hoisted = start.elapsed().as_secs_f64() * 1000.0;

        assert_eq!(
            checksum.to_bits(),
            checksum2.to_bits(),
            "{name}: results differ"
        );
        println!(
            "{name:34} per-call {per_call:8.1}ms   hoisted {hoisted:8.1}ms   {:.1}x",
            per_call / hoisted
        );
    }
}
