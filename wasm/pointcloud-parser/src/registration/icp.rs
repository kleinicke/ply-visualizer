//! Point-to-plane ICP refinement.
//!
//! Point-to-plane rather than point-to-point because the geometry these scans
//! contain is mostly planar. With a point-to-point cost, two overlapping views
//! of a flat wall are free to slide along it — the residual barely changes — so
//! the solver converges slowly and to whatever the initial guess happened to
//! favour. Projecting the residual onto the surface normal removes exactly that
//! free direction.
//!
//! The step is a Gauss-Newton solve on the small-angle parameterization: for a
//! source point `p`, target point `q` and target normal `n`, the linearized
//! residual is `n·(p−q) + (p×n)·ω + n·t`, so each correspondence contributes
//! the 6-vector `[p×n, n]` and the update is one 6x6 symmetric system.

use super::linalg::{solve_spd, Mat4};
use super::point_index::{
    estimate_normals, robust_extent, stride_down, voxel_downsample, PointGrid,
};

pub struct IcpOptions {
    pub initial: Mat4,
    /// Finest downsample cell. `None` derives it from the smaller cloud's
    /// robust working diameter.
    pub voxel_size: Option<f64>,
    /// Coarse-to-fine multipliers applied to the voxel size, largest first.
    pub scales: Vec<f64>,
    /// Correspondence gate as a multiple of the current scale's cell size.
    pub gate_factor: f64,
    /// Fraction of the closest correspondences kept each iteration.
    pub trim_ratio: f64,
    pub max_iterations_per_scale: usize,
    pub translation_epsilon: Option<f64>,
    pub rotation_epsilon: f64,
    /// Caps on the working set per scale, applied after voxel downsampling. A
    /// fine voxel on a dense station scan still leaves hundreds of thousands of
    /// points, and ICP is a nested loop over them — without these caps one
    /// refine runs for minutes.
    pub max_source_points: usize,
    pub max_target_points: usize,
}

impl Default for IcpOptions {
    fn default() -> Self {
        IcpOptions {
            initial: Mat4::identity(),
            voxel_size: None,
            scales: vec![4.0, 2.0, 1.0],
            gate_factor: 3.0,
            trim_ratio: 0.8,
            max_iterations_per_scale: 30,
            translation_epsilon: None,
            rotation_epsilon: 1e-5,
            max_source_points: 60_000,
            max_target_points: 200_000,
        }
    }
}

pub struct IcpResult {
    /// Maps source into target, including the initial pose it started from.
    pub matrix: Mat4,
    pub iterations: usize,
    pub inlier_count: usize,
    /// RMS of the point-to-plane residual over the inliers, in scene units.
    pub inlier_rmse: f64,
    /// Inliers as a fraction of the downsampled source — the overlap estimate.
    pub fitness: f64,
    /// True when the last scale stopped on the epsilons rather than the cap.
    pub converged: bool,
}

/// One coarse-to-fine level: both clouds downsampled to `cell`, plus the
/// target's grid and normals.
///
/// Cached because building it is most of the cost of a solve — the normal
/// estimate alone is a 48-neighbour PCA per target point — and
/// `register_clouds` runs ICP six times over the same pair while it decides
/// which yaw is right. Preparing each level once instead of once per attempt
/// is where the automatic path's runtime went.
pub struct ScaleLevel {
    pub scale: f64,
    gate: f64,
    source: Vec<f32>,
    grid: PointGrid,
    normals: Vec<f32>,
}

pub struct IcpPyramid {
    pub voxel_size: f64,
    levels: Vec<ScaleLevel>,
}

impl IcpPyramid {
    /// Levels for every requested scale, skipping any that leaves too few
    /// points to solve with.
    pub fn build(
        source: &[f32],
        target: &[f32],
        voxel_size: f64,
        options: &IcpOptions,
    ) -> IcpPyramid {
        let mut scales: Vec<f64> = options.scales.clone();
        scales.sort_by(|a, b| b.total_cmp(a));
        scales.dedup();

        let mut levels = Vec::new();
        for scale in scales {
            let cell = voxel_size * scale;
            let source_down =
                stride_down(&voxel_downsample(source, cell), options.max_source_points);
            let target_down =
                stride_down(&voxel_downsample(target, cell), options.max_target_points);
            if source_down.len() < 30 || target_down.len() < 30 {
                continue;
            }
            let gate = cell * options.gate_factor;
            let grid = PointGrid::new(target_down, gate);
            let normals = estimate_normals(&grid, cell * 2.5, 6);
            levels.push(ScaleLevel {
                scale,
                gate,
                source: source_down,
                grid,
                normals,
            });
        }
        IcpPyramid { voxel_size, levels }
    }
}

/// The finest cell `icp_point_to_plane` would use for a pair, exposed so
/// callers comparing two runs can normalize their residuals by the same scale.
pub fn default_voxel_size(source: &[f32], target: &[f32]) -> f64 {
    // The smaller of the two: registration only has to describe the volume both
    // scans saw, and the larger cloud's reach says nothing about that.
    (robust_extent(source, 100_000).min(robust_extent(target, 100_000)) / 400.0).max(1e-4)
}

/// `source` and `target` are flat xyz triples in world space.
pub fn icp_point_to_plane(
    source: &[f32],
    target: &[f32],
    options: &IcpOptions,
) -> Option<IcpResult> {
    if source.len() < 30 || target.len() < 30 {
        return None;
    }
    let voxel_size = options
        .voxel_size
        .unwrap_or_else(|| default_voxel_size(source, target));
    let pyramid = IcpPyramid::build(source, target, voxel_size, options);
    icp_on_pyramid(&pyramid, options, None, None)
}

/// Runs the solve over prepared levels.
///
/// `only_scales` restricts it to a subset (the screening pass uses the coarse
/// end of a shared pyramid), and `source_stride` thins the query set further
/// without rebuilding anything.
pub fn icp_on_pyramid(
    pyramid: &IcpPyramid,
    options: &IcpOptions,
    only_scales: Option<&[f64]>,
    source_stride: Option<usize>,
) -> Option<IcpResult> {
    let trim_ratio = options.trim_ratio.clamp(0.1, 1.0);
    let translation_epsilon = options
        .translation_epsilon
        .unwrap_or(pyramid.voxel_size * 0.01);
    let stride = source_stride.unwrap_or(1).max(1);

    let mut current = options.initial;
    let mut total_iterations = 0usize;
    let mut inlier_count = 0usize;
    let mut inlier_rmse = 0.0;
    let mut fitness = 0.0;
    let mut converged = false;

    for level in &pyramid.levels {
        if let Some(allowed) = only_scales {
            if !allowed
                .iter()
                .any(|scale| (scale - level.scale).abs() < 1e-9)
            {
                continue;
            }
        }
        let source_down = &level.source;
        let target_down = &level.grid.points;
        let normals = &level.normals;
        let gate = level.gate;
        let source_count = source_down.len() / 3;
        let queries = source_count.div_ceil(stride);

        // Hoisted across iterations: the correspondence set is rebuilt every
        // pass and this is the hot loop's only allocation otherwise.
        let mut residuals = vec![0.0f64; queries];
        let mut jacobian = vec![0.0f64; queries * 6];
        let mut distances = vec![0.0f64; queries];
        let mut order: Vec<u32> = vec![0; queries];

        converged = false;
        for _ in 0..options.max_iterations_per_scale {
            total_iterations += 1;
            let mut matched = 0usize;

            let mut i = 0;
            while i < source_count {
                let moved = current.apply([
                    source_down[i * 3],
                    source_down[i * 3 + 1],
                    source_down[i * 3 + 2],
                ]);
                i += stride;
                let (px, py, pz) = (moved[0] as f64, moved[1] as f64, moved[2] as f64);
                let Some(nearest) = level.grid.nearest(px, py, pz, gate) else {
                    continue;
                };
                let nx = normals[nearest * 3] as f64;
                let ny = normals[nearest * 3 + 1] as f64;
                let nz = normals[nearest * 3 + 2] as f64;
                if nx == 0.0 && ny == 0.0 && nz == 0.0 {
                    continue;
                }

                let dx = px - target_down[nearest * 3] as f64;
                let dy = py - target_down[nearest * 3 + 1] as f64;
                let dz = pz - target_down[nearest * 3 + 2] as f64;

                let slot = matched;
                matched += 1;
                residuals[slot] = dx * nx + dy * ny + dz * nz;
                distances[slot] = (dx * dx + dy * dy + dz * dz).sqrt();
                // [p x n, n]
                jacobian[slot * 6] = py * nz - pz * ny;
                jacobian[slot * 6 + 1] = pz * nx - px * nz;
                jacobian[slot * 6 + 2] = px * ny - py * nx;
                jacobian[slot * 6 + 3] = nx;
                jacobian[slot * 6 + 4] = ny;
                jacobian[slot * 6 + 5] = nz;
            }

            if matched < 6 {
                break;
            }

            // Trimming: the far tail of the correspondence set is dominated by
            // surfaces only one of the two scans saw, and those pull the fit
            // toward geometry that has no counterpart at all.
            let mut cutoff = f64::INFINITY;
            if trim_ratio < 1.0 {
                for (i, slot) in order[..matched].iter_mut().enumerate() {
                    *slot = i as u32;
                }
                order[..matched]
                    .sort_by(|&a, &b| distances[a as usize].total_cmp(&distances[b as usize]));
                let kept = ((matched as f64 * trim_ratio) as usize).max(6);
                cutoff = distances[order[kept - 1] as usize];
            }

            let mut a = [0.0f64; 36];
            let mut b = [0.0f64; 6];
            let mut squared_sum = 0.0;
            let mut used = 0usize;
            for i in 0..matched {
                if distances[i] > cutoff {
                    continue;
                }
                let r = residuals[i];
                squared_sum += r * r;
                used += 1;
                for row in 0..6 {
                    let jr = jacobian[i * 6 + row];
                    b[row] -= jr * r;
                    for column in row..6 {
                        a[row * 6 + column] += jr * jacobian[i * 6 + column];
                    }
                }
            }
            for row in 0..6 {
                for column in 0..row {
                    a[row * 6 + column] = a[column * 6 + row];
                }
                // Levenberg-style floor: keeps the system solvable when a scene
                // is degenerate for one degree of freedom (a single flat wall
                // constrains nothing along itself).
                a[row * 6 + row] += 1e-9;
            }

            let Some(step) = solve_spd::<6>(&a, &b) else {
                break;
            };

            inlier_count = used;
            inlier_rmse = (squared_sum / used.max(1) as f64).sqrt();
            fitness = used as f64 / queries.max(1) as f64;

            let angle = (step[0] * step[0] + step[1] * step[1] + step[2] * step[2]).sqrt();
            let mut delta = if angle > 1e-12 {
                Mat4::rotation_axis([step[0] / angle, step[1] / angle, step[2] / angle], angle)
            } else {
                Mat4::identity()
            };
            delta.set_position(step[3], step[4], step[5]);
            current = delta.multiply(&current);

            let translation = (step[3] * step[3] + step[4] * step[4] + step[5] * step[5]).sqrt();
            if angle < options.rotation_epsilon && translation < translation_epsilon {
                converged = true;
                break;
            }
        }
    }

    if inlier_count == 0 {
        return None;
    }
    Some(IcpResult {
        matrix: current,
        iterations: total_iterations,
        inlier_count,
        inlier_rmse,
        fitness,
        converged,
    })
}
