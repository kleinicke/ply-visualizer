//! Scan-to-scan registration: align one loaded cloud onto another.
//!
//! Written for the case X3A archives create — several stations of the same
//! site, each expressed relative to its own capture position, with no pose
//! anywhere in the container to recover the relationship from. It is not
//! specific to X3A: the inputs are plain world-space coordinates, so any two
//! overlapping clouds work.
//!
//! Three stages, deliberately separable because they fail differently:
//!
//! - `fit_rigid_transform` — manual correspondences. Always works, needs a human.
//! - `coarse_align_4dof` — automatic, exploits that terrestrial scans are level.
//! - `icp_point_to_plane` — refinement; needs a start already close to right.
//!
//! `register_clouds` runs coarse-then-ICP, which is the normal path.

pub mod bindings;
pub mod coarse_align;
pub mod fft;
pub mod icp;
pub mod linalg;
pub mod point_index;
pub mod rigid_fit;

#[cfg(test)]
mod tests;

use coarse_align::{coarse_align_4dof, CoarseOptions, CoarseResult};
use icp::{default_voxel_size, icp_on_pyramid, IcpOptions, IcpPyramid, IcpResult};
use linalg::Mat4;

pub struct RegisterOptions {
    pub coarse: Option<CoarseOptions>,
    pub icp: Option<IcpOptions>,
    /// How many of the coarse stage's yaw candidates to refine. Each costs one
    /// ICP run. 1 trusts the top peak; the default tries the shortlist.
    pub max_candidates: usize,
}

pub struct RegisterResult {
    pub matrix: Mat4,
    pub coarse: Option<CoarseResult>,
    pub icp: Option<IcpResult>,
    /// Which coarse candidate won, or -1 when the coarse stage was skipped.
    pub candidate_index: i32,
    pub candidates_tried: usize,
}

/// Quality of a converged ICP result, for choosing between poses.
///
/// Neither term works alone. Fitness alone prefers a loose pose that keeps
/// every point inside a wide gate; RMS alone prefers a pose that locked onto
/// one small patch and matched nothing else — which is exactly what a wrong yaw
/// looks like after refinement. Rewarding overlap while penalizing residual
/// relative to the cell size ranks the honest fit above both.
fn icp_quality(result: &IcpResult, cell: f64) -> f64 {
    result.fitness / (1.0 + result.inlier_rmse / cell.max(1e-6))
}

pub fn register_clouds(
    source: &[f32],
    target: &[f32],
    options: RegisterOptions,
) -> Option<RegisterResult> {
    let mut matrix = options
        .icp
        .as_ref()
        .map(|icp| icp.initial)
        .unwrap_or_else(Mat4::identity);

    let coarse = options
        .coarse
        .as_ref()
        .and_then(|coarse| coarse_align_4dof(source, target, coarse));
    if let Some(result) = &coarse {
        matrix = result.best.matrix;
    }

    let mut icp_result: Option<IcpResult> = None;
    let mut candidate_index = -1i32;
    let mut candidates_tried = 0usize;

    if let Some(icp_options) = &options.icp {
        // Refining every shortlisted yaw and keeping the best is what makes the
        // automatic path work on real scans, where the correct yaw often is not
        // the tallest correlation peak. Without a coarse stage there is one start.
        let starts: Vec<Mat4> = match &coarse {
            Some(result) => result
                .candidates
                .iter()
                .take(options.max_candidates.max(1))
                .map(|candidate| candidate.matrix)
                .collect(),
            None => vec![matrix],
        };

        // Screening pass: coarse scales and a low iteration cap are enough to
        // tell a yaw that is converging from one that is wandering, and running
        // the full ladder on every candidate is what made this take minutes.
        let screening = starts.len() > 1;
        let cell = icp_options
            .voxel_size
            .unwrap_or_else(|| default_voxel_size(source, target));

        // One pyramid for every attempt. Preparing a level — voxel downsample,
        // grid, PCA normals over the target — dwarfs the iteration loop that
        // uses it, so doing it once instead of once per candidate is the whole
        // difference between a snappy auto-align and a coffee break.
        let screening_scales = vec![8.0, 4.0];
        let mut all_scales: Vec<f64> = icp_options.scales.clone();
        if screening {
            all_scales.extend_from_slice(&screening_scales);
        }
        let pyramid = IcpPyramid::build(
            source,
            target,
            cell,
            &IcpOptions {
                scales: all_scales,
                ..clone_icp_options(icp_options)
            },
        );

        // The screening pass wants a thinner query set than the final refine;
        // striding the prepared level costs nothing, where a second pyramid at
        // a lower cap would cost everything it just saved.
        let screening_stride = (icp_options.max_source_points / 20_000).max(1);
        let screening_options = IcpOptions {
            max_iterations_per_scale: 12,
            ..clone_icp_options(icp_options)
        };

        let mut best_quality = f64::NEG_INFINITY;
        let mut best_start: Option<Mat4> = None;
        for (index, start) in starts.iter().enumerate() {
            let attempt = if screening {
                icp_on_pyramid(
                    &pyramid,
                    &IcpOptions {
                        initial: *start,
                        ..clone_icp_options(&screening_options)
                    },
                    Some(&screening_scales),
                    Some(screening_stride),
                )
            } else {
                icp_on_pyramid(
                    &pyramid,
                    &IcpOptions {
                        initial: *start,
                        ..clone_icp_options(icp_options)
                    },
                    None,
                    None,
                )
            };
            candidates_tried += 1;
            let Some(attempt) = attempt else {
                continue;
            };

            // Candidates arrive in coarse-score order, and a later one has to
            // be clearly better to displace an earlier one. Without that margin
            // a symmetric scene hands the win to whichever near-tie was
            // measured last: in a rectangular room the 180-degree flip fits
            // every wall, and only the correlation peak knows which way round
            // the room actually is.
            let quality = icp_quality(&attempt, cell);
            let threshold = if best_start.is_some() {
                best_quality * 1.05
            } else {
                best_quality
            };
            if quality > threshold {
                best_quality = quality;
                best_start = Some(attempt.matrix);
                candidate_index = if coarse.is_some() { index as i32 } else { -1 };
                icp_result = Some(attempt);
            }
        }

        // Full-resolution refinement, once, on whichever start survived.
        if screening {
            if let Some(start) = best_start {
                let refined = icp_on_pyramid(
                    &pyramid,
                    &IcpOptions {
                        initial: start,
                        ..clone_icp_options(icp_options)
                    },
                    Some(&icp_options.scales),
                    None,
                );
                if let Some(result) = refined {
                    icp_result = Some(result);
                }
            }
        }
        if let Some(result) = &icp_result {
            matrix = result.matrix;
        }
    }

    if coarse.is_none() && icp_result.is_none() {
        return None;
    }
    Some(RegisterResult {
        matrix,
        coarse,
        icp: icp_result,
        candidate_index,
        candidates_tried,
    })
}

/// `IcpOptions` holds a `Vec`, so it is not `Copy`; this keeps the call sites
/// above readable without making the option struct clonable in the public API.
fn clone_icp_options(options: &IcpOptions) -> IcpOptions {
    IcpOptions {
        initial: options.initial,
        voxel_size: options.voxel_size,
        scales: options.scales.clone(),
        gate_factor: options.gate_factor,
        trim_ratio: options.trim_ratio,
        max_iterations_per_scale: options.max_iterations_per_scale,
        translation_epsilon: options.translation_epsilon,
        rotation_epsilon: options.rotation_epsilon,
        max_source_points: options.max_source_points,
        max_target_points: options.max_target_points,
    }
}
