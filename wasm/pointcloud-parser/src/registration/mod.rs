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
pub mod conditioning;
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
    /// Poses the caller already believes in, screened alongside the sweep's.
    ///
    /// The yaw sweep is a search for a pose from nothing, and it is the weakest
    /// link on scans that give the top-down raster little to correlate: a
    /// narrow window onto a flat wall correlates about as well at the wrong
    /// yaw as the right one. A caller often knows better. Aligning a set of
    /// scans, the pose of a cloud already placed is an excellent guess for the
    /// next one — scans shot from a single station share a pose exactly — and
    /// screening it here costs one pass over a pyramid that is already built.
    pub extra_starts: Vec<Mat4>,
}

pub struct RegisterResult {
    pub matrix: Mat4,
    /// Finest voxel cell the ICP stage used, so a caller can normalize the
    /// residual by the same scale the solver judged it at. Comparing two
    /// candidates' RMS without it compares numbers measured differently.
    pub voxel_cell: f64,
    pub coarse: Option<CoarseResult>,
    pub icp: Option<IcpResult>,
    /// Which coarse candidate won, or -1 when a caller-supplied start won or
    /// the coarse stage was skipped. Read it with `started_from`.
    pub candidate_index: i32,
    pub candidates_tried: usize,
    /// Which family of starting pose the winner came from: "coarse", "given",
    /// or "none". Worth reporting, because a run where the sweep never wins is
    /// a run where the sweep is not earning its seconds.
    pub started_from: &'static str,
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

/// Extra levels the screening pass runs on, relative to the caller's coarsest.
///
/// These used to be a fixed `[8.0, 4.0]`. For the default ladder of
/// `[4.0, 2.0, 1.0]` that is exactly twice and once its coarsest level, which
/// these multipliers reproduce — but a caller asking for a finer ladder used to
/// get the same absolute scales, and screening at scale 8 uses a gate of
/// several hundred millimetres. That is wide enough that a cloud sitting metres
/// away still finds correspondences on the far wall and outscores the right
/// answer, which is then discarded before any fine level looks at it.
/// Expressing them relative to the caller's own coarsest scale keeps the
/// screening gate proportional to the accuracy that caller asked for, and
/// leaves the default path byte-for-byte as it was.
const SCREENING_MULTIPLIERS: [f64; 2] = [2.0, 1.0];

fn screening_scales(scales: &[f64]) -> Vec<f64> {
    let coarsest = scales.iter().copied().fold(1.0f64, f64::max);
    SCREENING_MULTIPLIERS
        .iter()
        .map(|multiplier| coarsest * multiplier)
        .collect()
}

pub fn register_clouds(
    source: &[f32],
    target: &[f32],
    options: RegisterOptions,
) -> Option<RegisterResult> {
    let extra_starts = &options.extra_starts;
    let options = &options;
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
    let mut started_from = "none";
    let mut voxel_cell = 0.0f64;

    if let Some(icp_options) = &options.icp {
        // Refining every shortlisted yaw and keeping the best is what makes the
        // automatic path work on real scans, where the correct yaw often is not
        // the tallest correlation peak. Without a coarse stage there is one start.
        // The caller's guesses go first, and the 5 % margin below then means a
        // sweep candidate has to be clearly better to displace one.
        //
        // That ordering is the point, not an accident. A scan that sees mostly
        // one flat wall is free to slide along it at almost no cost in
        // residual, and because sliding keeps every point on the wall it can
        // even raise the overlap slightly. Fitness and RMS therefore cannot
        // tell a slid pose from the right one - measured on a real archive the
        // wrong pose scored 50% against the right pose's 49%. What does
        // separate them is where the guess came from: a pose inherited from a
        // scan shot at the same station is a structural fact, and it should not
        // lose to a statistical tie.
        let mut starts: Vec<Mat4> = extra_starts.to_vec();
        let given_start_count = starts.len();
        match &coarse {
            Some(result) => starts.extend(
                result
                    .candidates
                    .iter()
                    .take(options.max_candidates.max(1))
                    .map(|candidate| candidate.matrix),
            ),
            None => starts.push(matrix),
        }

        // Screening pass: coarse scales and a low iteration cap are enough to
        // tell a yaw that is converging from one that is wandering, and running
        // the full ladder on every candidate is what made this take minutes.
        let screening = starts.len() > 1;
        let cell = icp_options
            .voxel_size
            .unwrap_or_else(|| default_voxel_size(source, target));
        voxel_cell = cell;

        // One pyramid for every attempt. Preparing a level — voxel downsample,
        // grid, PCA normals over the target — dwarfs the iteration loop that
        // uses it, so doing it once instead of once per candidate is the whole
        // difference between a snappy auto-align and a coffee break.
        let screening_scales = screening_scales(&icp_options.scales);
        let mut all_scales: Vec<f64> = icp_options.scales.clone();
        if screening {
            all_scales.extend_from_slice(&screening_scales);
        }
        let level_options = IcpOptions {
            scales: all_scales,
            ..clone_icp_options(icp_options)
        };
        let pyramid = IcpPyramid::build(source, target, cell, &level_options);

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
                let given = index < given_start_count;
                started_from = if given {
                    "given"
                } else if coarse.is_some() {
                    "coarse"
                } else {
                    "none"
                };
                candidate_index = if !given && coarse.is_some() {
                    (index - given_start_count) as i32
                } else {
                    -1
                };
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
        voxel_cell,
        coarse,
        icp: icp_result,
        candidate_index,
        candidates_tried,
        started_from,
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
