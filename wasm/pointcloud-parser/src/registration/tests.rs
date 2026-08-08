//! Registration tests, mirroring what the TypeScript suite asserted before the
//! solvers moved here. Native `cargo test`, so they run without a browser and
//! without wasm-pack.

use super::coarse_align::{coarse_align_4dof, CoarseOptions, UpAxis};
use super::icp::{icp_point_to_plane, IcpOptions};
use super::linalg::{solve_spd, symmetric_eigen, Mat4};
use super::point_index::{estimate_normals, robust_extent, voxel_downsample, PointGrid};
use super::rigid_fit::fit_rigid_transform;
use super::{register_clouds, RegisterOptions};

/// Deterministic pseudo-random source, so a failure is always reproducible.
fn make_random(seed: u32) -> impl FnMut() -> f64 {
    let mut state = seed;
    move || {
        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
        state as f64 / 4294967296.0
    }
}

const ROOM_WIDTH: f64 = 8.0;
const ROOM_DEPTH: f64 = 6.0;
const ROOM_HEIGHT: f64 = 3.0;

/// A closed room: four walls, floor and ceiling, sampled at random, plus a
/// pillar that breaks the mirror symmetry so the yaw sweep has a single correct
/// answer. Stands in for what a station scan contains — large planes in several
/// orientations. Z is up, matching the scanner convention.
fn make_room(point_count: usize, seed: u32) -> Vec<f32> {
    let mut random = make_random(seed);
    let mut points = Vec::with_capacity(point_count * 3);
    for i in 0..point_count {
        let u = random();
        let v = random();
        let (x, y, z) = if i % 11 == 0 {
            (5.5 + u * 0.4, 1.0 + v * 0.4, random() * ROOM_HEIGHT)
        } else {
            match i % 6 {
                0 => (u * ROOM_WIDTH, 0.0, v * ROOM_HEIGHT),
                1 => (u * ROOM_WIDTH, ROOM_DEPTH, v * ROOM_HEIGHT),
                2 => (0.0, u * ROOM_DEPTH, v * ROOM_HEIGHT),
                3 => (ROOM_WIDTH, u * ROOM_DEPTH, v * ROOM_HEIGHT),
                4 => (u * ROOM_WIDTH, v * ROOM_DEPTH, 0.0),
                _ => (u * ROOM_WIDTH, v * ROOM_DEPTH, ROOM_HEIGHT),
            }
        };
        points.push(x as f32);
        points.push(y as f32);
        points.push(z as f32);
    }
    points
}

fn transform_points(points: &[f32], matrix: &Mat4) -> Vec<f32> {
    let mut out = Vec::with_capacity(points.len());
    for i in (0..points.len()).step_by(3) {
        out.extend_from_slice(&matrix.apply([points[i], points[i + 1], points[i + 2]]));
    }
    out
}

/// Largest distance between corresponding points under two transforms.
fn max_deviation(points: &[f32], a: &Mat4, b: &Mat4, stride: usize) -> f64 {
    let mut worst: f64 = 0.0;
    let mut i = 0;
    while i < points.len() {
        let point = [points[i], points[i + 1], points[i + 2]];
        let pa = a.apply(point);
        let pb = b.apply(point);
        let distance = (((pa[0] - pb[0]) as f64).powi(2)
            + ((pa[1] - pb[1]) as f64).powi(2)
            + ((pa[2] - pb[2]) as f64).powi(2))
        .sqrt();
        worst = worst.max(distance);
        i += 3 * stride;
    }
    worst
}

/// Unit-normalized axis, so every `truth` below is an exact rotation. A
/// slightly non-unit axis makes `rotation_axis` return something that is not
/// orthonormal, and then no rigid fit can reproduce it exactly.
fn axis(x: f64, y: f64, z: f64) -> [f64; 3] {
    let length = (x * x + y * y + z * z).sqrt();
    [x / length, y / length, z / length]
}

fn yaw_matrix(degrees: f64, x: f64, y: f64, z: f64) -> Mat4 {
    let mut m = Mat4::rotation_axis([0.0, 0.0, 1.0], degrees.to_radians());
    m.set_position(x, y, z);
    m
}

/// Inverse of a rigid transform, built from the transpose of its rotation.
fn invert_rigid(matrix: &Mat4) -> Mat4 {
    let m = &matrix.0;
    let mut out = Mat4::identity();
    for row in 0..3 {
        for column in 0..3 {
            out.0[column * 4 + row] = m[row * 4 + column];
        }
    }
    let t = [m[12], m[13], m[14]];
    out.set_position(
        -(out.0[0] * t[0] + out.0[4] * t[1] + out.0[8] * t[2]),
        -(out.0[1] * t[0] + out.0[5] * t[1] + out.0[9] * t[2]),
        -(out.0[2] * t[0] + out.0[6] * t[1] + out.0[10] * t[2]),
    );
    out
}

#[test]
fn symmetric_eigen_recovers_a_known_spectrum() {
    // diag(3, 2, 1) rotated into a general basis.
    let rotation = Mat4::rotation_axis(axis(0.267, -0.535, 0.802), 0.9);
    let r = &rotation.0;
    let basis = [[r[0], r[1], r[2]], [r[4], r[5], r[6]], [r[8], r[9], r[10]]];
    let lambda = [3.0, 2.0, 1.0];
    let mut a = [0.0f64; 9];
    for k in 0..3 {
        for i in 0..3 {
            for j in 0..3 {
                a[i * 3 + j] += lambda[k] * basis[k][i] * basis[k][j];
            }
        }
    }

    let (values, vectors) = symmetric_eigen::<3>(&a);
    for k in 0..3 {
        assert!(
            (values[k] - lambda[k]).abs() < 1e-9,
            "value {k}: {}",
            values[k]
        );
        for i in 0..3 {
            let av = a[i * 3] * vectors[k][0]
                + a[i * 3 + 1] * vectors[k][1]
                + a[i * 3 + 2] * vectors[k][2];
            assert!((av - values[k] * vectors[k][i]).abs() < 1e-9);
        }
    }
}

#[test]
fn cholesky_solves_and_refuses_indefinite_systems() {
    let a = [4.0, 1.0, 0.0, 1.0, 3.0, 1.0, 0.0, 1.0, 2.0];
    let x = [1.0, -2.0, 3.0];
    let b: Vec<f64> = (0..3)
        .map(|i| a[i * 3] * x[0] + a[i * 3 + 1] * x[1] + a[i * 3 + 2] * x[2])
        .collect();

    let solved = solve_spd::<3>(&a, &b).expect("positive definite");
    for i in 0..3 {
        assert!(
            (solved[i] - x[i]).abs() < 1e-9,
            "component {i}: {}",
            solved[i]
        );
    }

    assert!(solve_spd::<2>(&[1.0, 2.0, 2.0, 1.0], &[1.0, 1.0]).is_none());
}

#[test]
fn rigid_fit_recovers_an_exact_transform() {
    let truth = {
        let mut m = Mat4::rotation_axis(axis(0.4, 0.8, 0.44), 0.7);
        m.set_position(1.5, -2.25, 0.75);
        m
    };
    let source: Vec<f32> = vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.2, 0.3, 1.0];
    let target = transform_points(&source, &truth);

    let fit = fit_rigid_transform(&source, &target).expect("a fit");
    assert!(fit.rmse < 1e-5, "rmse {}", fit.rmse);
    assert!(max_deviation(&source, &fit.matrix, &truth, 1) < 1e-4);
}

#[test]
fn rigid_fit_produces_a_rotation_never_a_reflection() {
    // Nearly collinear points: the degenerate case where an SVD-based fit needs
    // a determinant fix-up and can otherwise mirror the cloud.
    let truth = {
        let mut m = Mat4::rotation_axis(axis(0.4, 0.8, 0.44), 0.7);
        m.set_position(1.5, -2.25, 0.75);
        m
    };
    let source: Vec<f32> = vec![
        0.0, 0.0, 0.0, 1.0, 1e-7, 0.0, 2.0, -1e-7, 0.0, 3.0, 0.0, 0.0,
    ];
    let target = transform_points(&source, &truth);
    let fit = fit_rigid_transform(&source, &target).expect("a fit");

    let m = &fit.matrix.0;
    let determinant = m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2])
        + m[8] * (m[1] * m[6] - m[5] * m[2]);
    assert!(
        (determinant - 1.0).abs() < 1e-6,
        "determinant {determinant}"
    );
}

#[test]
fn rigid_fit_rejects_input_it_cannot_fit() {
    assert!(fit_rigid_transform(&[0.0, 0.0, 0.0], &[1.0, 1.0, 1.0]).is_none());
    assert!(
        fit_rigid_transform(&[0.0; 9], &[0.0; 12]).is_none(),
        "mismatched lengths"
    );
    // All source points coincident: no orientation is recoverable.
    assert!(
        fit_rigid_transform(&[0.0; 9], &[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0]).is_none()
    );
}

#[test]
fn voxel_downsample_collapses_a_cell_to_its_mean() {
    let points: Vec<f32> = vec![0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.2, 0.0, 0.0, 5.0, 5.0, 5.0];
    let reduced = voxel_downsample(&points, 1.0);
    assert_eq!(reduced.len() / 3, 2);
    let near = if reduced[0] < 1.0 {
        &reduced[0..3]
    } else {
        &reduced[3..6]
    };
    assert!((near[0] - 0.1).abs() < 1e-6, "mean x {}", near[0]);
}

#[test]
fn grid_nearest_agrees_with_brute_force_and_honours_its_gate() {
    let mut random = make_random(4242);
    let count = 4000;
    let points: Vec<f32> = (0..count * 3).map(|_| (random() * 10.0) as f32).collect();
    let grid = PointGrid::new(points.clone(), 0.5);

    for _ in 0..50 {
        let (qx, qy, qz) = (random() * 10.0, random() * 10.0, random() * 10.0);
        let mut best_index = 0usize;
        let mut best_sq = f64::INFINITY;
        for i in 0..count {
            let dx = points[i * 3] as f64 - qx;
            let dy = points[i * 3 + 1] as f64 - qy;
            let dz = points[i * 3 + 2] as f64 - qz;
            let squared = dx * dx + dy * dy + dz * dz;
            if squared < best_sq {
                best_sq = squared;
                best_index = i;
            }
        }
        if best_sq.sqrt() <= 2.0 {
            assert_eq!(grid.nearest(qx, qy, qz, 2.0), Some(best_index));
        }
    }

    // Nothing within the gate must report nothing, not the closest miss.
    assert_eq!(grid.nearest(1000.0, 1000.0, 1000.0, 1.0), None);
}

#[test]
fn normals_find_the_plane_and_leave_sparse_points_at_zero() {
    let mut points: Vec<f32> = Vec::new();
    for i in 0..30 {
        for j in 0..30 {
            points.extend_from_slice(&[i as f32 * 0.1, j as f32 * 0.1, 2.0]);
        }
    }
    // An isolated point far from the plane has no neighbourhood to fit.
    points.extend_from_slice(&[50.0, 50.0, 50.0]);
    let grid = PointGrid::new(points.clone(), 0.4);
    let normals = estimate_normals(&grid, 0.4, 6);

    let middle = 15 * 30 + 15;
    assert!(
        (normals[middle * 3 + 2].abs() - 1.0).abs() < 1e-4,
        "normal z {}",
        normals[middle * 3 + 2]
    );
    let isolated = points.len() / 3 - 1;
    assert_eq!(
        (
            normals[isolated * 3],
            normals[isolated * 3 + 1],
            normals[isolated * 3 + 2]
        ),
        (0.0, 0.0, 0.0)
    );
}

#[test]
fn robust_extent_describes_the_core_not_the_tail() {
    // A station scan in miniature: a dense 20 m core with a few returns
    // reaching 500 m. The bounding box says 1000 m; the useful scale is ~20 m.
    let mut random = make_random(17);
    let mut points: Vec<f32> = Vec::new();
    for _ in 0..20000 {
        for _ in 0..3 {
            points.push(((random() - 0.5) * 20.0) as f32);
        }
    }
    for _ in 0..200 {
        for _ in 0..3 {
            points.push(((random() - 0.5) * 1000.0) as f32);
        }
    }
    let extent = robust_extent(&points, 100_000);
    assert!(extent > 10.0 && extent < 30.0, "extent {extent}");
}

#[test]
fn fft_inverse_restores_the_input() {
    use super::fft::fft2d;
    let n = 8;
    let mut random = make_random(5);
    let original: Vec<f64> = (0..n * n).map(|_| random()).collect();
    let mut re = original.clone();
    let mut im = vec![0.0f64; n * n];
    fft2d(&mut re, &mut im, n, false);
    fft2d(&mut re, &mut im, n, true);
    for i in 0..n * n {
        assert!(
            (re[i] - original[i]).abs() < 1e-9,
            "index {i}: {} vs {}",
            re[i],
            original[i]
        );
        assert!(im[i].abs() < 1e-9);
    }
}

#[test]
fn coarse_align_recovers_yaw_and_translation() {
    let room = make_room(60000, 2024);
    // `truth` maps target-frame geometry into the source frame, so the
    // registration answer is its inverse.
    let truth = yaw_matrix(37.0, 1.7, -1.1, 0.35);
    let source = transform_points(&room, &truth);

    let result = coarse_align_4dof(
        &source,
        &room,
        &CoarseOptions {
            up_axis: UpAxis::Z,
            resolution: 128,
            ..Default::default()
        },
    )
    .expect("a coarse result");
    assert!(
        result.best.score > result.runner_up_score,
        "winner must beat the runner-up"
    );
    assert!(result.candidates.len() > 1, "expected a shortlist");
    // Sorted, and separated: two entries must not describe the same peak.
    for i in 1..result.candidates.len() {
        assert!(result.candidates[i - 1].score >= result.candidates[i].score);
        let gap = (result.candidates[i].yaw_degrees - result.candidates[i - 1].yaw_degrees).abs();
        assert!(
            gap.min(360.0 - gap) > 1.0,
            "candidates {} and {i} are one peak",
            i - 1
        );
    }

    // Cell size on this scene is ~9 cm and the sweep refines yaw to 1 degree, so
    // a couple of cells of residual is the honest tolerance for this stage.
    let deviation = max_deviation(&source, &result.best.matrix, &invert_rigid(&truth), 37);
    assert!(deviation < 0.5, "deviation {deviation:.3} m");
}

#[test]
fn coarse_align_rejects_unusable_input() {
    let room = make_room(100, 1);
    assert!(coarse_align_4dof(
        &room,
        &room,
        &CoarseOptions {
            resolution: 100,
            ..Default::default()
        }
    )
    .is_none());
    assert!(coarse_align_4dof(&[0.0; 3], &[0.0; 3], &CoarseOptions::default()).is_none());
}

#[test]
fn icp_converges_from_a_rough_start() {
    let room = make_room(40000, 555);
    let truth = {
        let mut m = Mat4::rotation_axis(axis(0.1, -0.08, 0.99), 0.121);
        m.set_position(0.4, -0.3, 0.1);
        m
    };
    let source = transform_points(&room, &truth);

    let result = icp_point_to_plane(
        &source,
        &room,
        &IcpOptions {
            voxel_size: Some(0.05),
            ..Default::default()
        },
    )
    .expect("an ICP result");
    assert!(result.fitness > 0.5, "fitness {}", result.fitness);
    assert!(result.inlier_rmse < 0.02, "rmse {}", result.inlier_rmse);

    let deviation = max_deviation(&source, &result.matrix, &invert_rigid(&truth), 37);
    assert!(deviation < 0.05, "deviation {deviation:.4} m");
}

#[test]
fn icp_leaves_an_aligned_pair_alone() {
    let room = make_room(20000, 31);
    let result = icp_point_to_plane(
        &room,
        &room,
        &IcpOptions {
            voxel_size: Some(0.05),
            ..Default::default()
        },
    )
    .expect("an ICP result");
    let deviation = max_deviation(&room, &result.matrix, &Mat4::identity(), 37);
    assert!(deviation < 0.01, "drifted {deviation}");
}

#[test]
fn icp_reports_low_fitness_without_overlap() {
    let room = make_room(20000, 8);
    let elsewhere = transform_points(&room, &Mat4::translation(500.0, 500.0, 500.0));
    let result = icp_point_to_plane(
        &room,
        &elsewhere,
        &IcpOptions {
            voxel_size: Some(0.05),
            ..Default::default()
        },
    );
    // Either no correspondence survives the gate at all, or almost none does.
    match result {
        None => {}
        Some(result) => assert!(result.fitness < 0.05, "fitness {}", result.fitness),
    }
}

#[test]
fn register_clouds_recovers_a_station_offset_to_centimetres() {
    let room = make_room(60000, 777);
    let truth = yaw_matrix(-64.0, -2.3, 1.4, 0.2);
    let source = transform_points(&room, &truth);

    let result = register_clouds(
        &source,
        &room,
        RegisterOptions {
            coarse: Some(CoarseOptions {
                up_axis: UpAxis::Z,
                resolution: 128,
                ..Default::default()
            }),
            icp: Some(IcpOptions {
                voxel_size: Some(0.05),
                ..Default::default()
            }),
            max_candidates: 5,
        },
    )
    .expect("a registration result");

    assert!(result.coarse.is_some(), "coarse stage should have run");
    let icp = result.icp.as_ref().expect("icp stage should have run");
    assert!(icp.fitness > 0.5, "fitness {}", icp.fitness);
    assert!(
        result.candidates_tried > 1,
        "should have refined several candidates"
    );
    assert!(
        result.candidate_index >= 0,
        "a coarse candidate should have won"
    );

    let deviation = max_deviation(&source, &result.matrix, &invert_rigid(&truth), 37);
    assert!(deviation < 0.05, "deviation {deviation:.4} m");
}

#[test]
fn a_single_candidate_skips_the_screening_pass() {
    let room = make_room(30000, 21);
    let truth = yaw_matrix(15.0, 0.0, 0.0, 0.0);
    let source = transform_points(&room, &truth);

    let result = register_clouds(
        &source,
        &room,
        RegisterOptions {
            coarse: Some(CoarseOptions {
                up_axis: UpAxis::Z,
                ..Default::default()
            }),
            icp: Some(IcpOptions {
                voxel_size: Some(0.05),
                ..Default::default()
            }),
            max_candidates: 1,
        },
    )
    .expect("a registration result");
    assert_eq!(result.candidates_tried, 1);

    let deviation = max_deviation(&source, &result.matrix, &invert_rigid(&truth), 37);
    assert!(deviation < 0.05, "deviation {deviation:.4} m");
}
