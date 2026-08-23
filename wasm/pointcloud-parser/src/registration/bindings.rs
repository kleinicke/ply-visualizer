//! The JS-facing surface of the registration solvers.
//!
//! Options arrive as JSON and results leave as a column-major 4x4 plus a JSON
//! stats blob. That keeps one marshalling path for every stage instead of a
//! wasm-bindgen struct per option set, and the payloads are tens of bytes next
//! to the megabytes of point data.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::coarse_align::{coarse_align_4dof, CoarseOptions, RasterFeature, UpAxis};
use super::conditioning::position_conditioning;
use super::icp::{default_voxel_size, icp_point_to_plane, IcpOptions};
use super::linalg::Mat4;
use super::rigid_fit::fit_rigid_transform;
use super::{register_clouds, RegisterOptions};

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct CoarseSettings {
    pub up_axis: Option<String>,
    pub resolution: Option<usize>,
    pub yaw_step_degrees: Option<f64>,
    pub max_samples: Option<usize>,
    pub feature: Option<String>,
    pub candidate_count: Option<usize>,
    pub peaks_per_yaw: Option<usize>,
    pub window_factor: Option<f64>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct IcpSettings {
    pub initial: Option<Vec<f64>>,
    pub voxel_size: Option<f64>,
    pub scales: Option<Vec<f64>>,
    pub gate_factor: Option<f64>,
    pub trim_ratio: Option<f64>,
    pub max_iterations_per_scale: Option<usize>,
    pub translation_epsilon: Option<f64>,
    pub rotation_epsilon: Option<f64>,
    pub max_source_points: Option<usize>,
    pub max_target_points: Option<usize>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct RegisterSettings {
    /// Absent disables the stage, matching the TypeScript `coarse: false`.
    pub coarse: Option<CoarseSettings>,
    pub icp: Option<IcpSettings>,
    pub max_candidates: Option<usize>,
    /// Extra starting poses to screen, each a column-major 4x4.
    pub extra_starts: Option<Vec<Vec<f64>>>,
}

impl CoarseSettings {
    fn build(&self) -> CoarseOptions {
        let defaults = CoarseOptions::default();
        CoarseOptions {
            up_axis: self
                .up_axis
                .as_deref()
                .map(UpAxis::from_str)
                .unwrap_or(defaults.up_axis),
            resolution: self.resolution.unwrap_or(defaults.resolution),
            yaw_step_degrees: self.yaw_step_degrees.unwrap_or(defaults.yaw_step_degrees),
            max_samples: self.max_samples.unwrap_or(defaults.max_samples),
            feature: self
                .feature
                .as_deref()
                .map(RasterFeature::from_str)
                .unwrap_or(defaults.feature),
            candidate_count: self.candidate_count.unwrap_or(defaults.candidate_count),
            peaks_per_yaw: self.peaks_per_yaw.unwrap_or(defaults.peaks_per_yaw),
            window_factor: self.window_factor.unwrap_or(defaults.window_factor),
        }
    }
}

impl IcpSettings {
    fn build(&self) -> IcpOptions {
        let defaults = IcpOptions::default();
        IcpOptions {
            initial: self
                .initial
                .as_ref()
                .filter(|values| values.len() == 16)
                .map(|values| Mat4::from_slice(values))
                .unwrap_or(defaults.initial),
            voxel_size: self.voxel_size,
            scales: self.scales.clone().unwrap_or(defaults.scales),
            gate_factor: self.gate_factor.unwrap_or(defaults.gate_factor),
            trim_ratio: self.trim_ratio.unwrap_or(defaults.trim_ratio),
            max_iterations_per_scale: self
                .max_iterations_per_scale
                .unwrap_or(defaults.max_iterations_per_scale),
            translation_epsilon: self.translation_epsilon,
            rotation_epsilon: self.rotation_epsilon.unwrap_or(defaults.rotation_epsilon),
            max_source_points: self.max_source_points.unwrap_or(defaults.max_source_points),
            max_target_points: self.max_target_points.unwrap_or(defaults.max_target_points),
        }
    }
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct CoarseCandidateStats {
    yaw_degrees: f64,
    score: f64,
    matrix: Vec<f64>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct CoarseStats {
    yaw_degrees: f64,
    score: f64,
    runner_up_score: f64,
    candidates: Vec<CoarseCandidateStats>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct IcpStats {
    iterations: usize,
    inlier_count: usize,
    inlier_rmse: f64,
    fitness: f64,
    converged: bool,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct RegisterStats {
    coarse: Option<CoarseStats>,
    icp: Option<IcpStats>,
    candidate_index: i32,
    candidates_tried: usize,
    /// "coarse", "given" or "none" - which start the winning pose came from.
    started_from: Option<String>,
    /// Finest voxel cell the ICP stage used; see `RegisterResult::voxel_cell`.
    voxel_cell: Option<f64>,
    /// How well the *source* cloud's own surfaces pin its position down; see
    /// `conditioning::position_conditioning`. Carried on the result because a
    /// caller ordering a multi-cloud run needs it to know whether this pose is
    /// evidence or a guess, and the source is already here.
    source_conditioning: Option<f64>,
    rmse: Option<f64>,
    max_error: Option<f64>,
}

/// Column-major 4x4 pose plus a JSON stats blob, for every stage.
#[wasm_bindgen]
pub struct RegistrationResult {
    matrix: Vec<f64>,
    stats: String,
}

#[wasm_bindgen]
impl RegistrationResult {
    #[wasm_bindgen(getter)]
    pub fn matrix(&self) -> Vec<f64> {
        self.matrix.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn stats(&self) -> String {
        self.stats.clone()
    }
}

fn stats_json(stats: &RegisterStats) -> String {
    serde_json::to_string(stats).unwrap_or_else(|_| "{}".to_string())
}

/// Coarse sweep and/or ICP refinement, per `settings_json`.
///
/// `source` and `target` are flat xyz triples in world space. Returns
/// `undefined` when nothing could be registered.
#[wasm_bindgen]
pub fn register_pair(
    source: &[f32],
    target: &[f32],
    settings_json: &str,
) -> Option<RegistrationResult> {
    let settings: RegisterSettings = serde_json::from_str(settings_json).unwrap_or_default();
    let options = RegisterOptions {
        coarse: settings.coarse.as_ref().map(|coarse| coarse.build()),
        icp: settings.icp.as_ref().map(|icp| icp.build()),
        max_candidates: settings.max_candidates.unwrap_or(5),
        // A malformed entry is dropped rather than failing the call: the sweep
        // is still a complete answer without the caller's hint.
        extra_starts: settings
            .extra_starts
            .as_deref()
            .unwrap_or_default()
            .iter()
            .filter(|values| values.len() == 16)
            .map(|values| Mat4::from_slice(values))
            .collect(),
    };
    let result = register_clouds(source, target, options)?;

    let stats = RegisterStats {
        coarse: result.coarse.as_ref().map(|coarse| CoarseStats {
            yaw_degrees: coarse.best.yaw_degrees,
            score: coarse.best.score,
            runner_up_score: coarse.runner_up_score,
            candidates: coarse
                .candidates
                .iter()
                .map(|candidate| CoarseCandidateStats {
                    yaw_degrees: candidate.yaw_degrees,
                    score: candidate.score,
                    matrix: candidate.matrix.0.to_vec(),
                })
                .collect(),
        }),
        icp: result.icp.as_ref().map(|icp| IcpStats {
            iterations: icp.iterations,
            inlier_count: icp.inlier_count,
            inlier_rmse: icp.inlier_rmse,
            fitness: icp.fitness,
            converged: icp.converged,
        }),
        candidate_index: result.candidate_index,
        candidates_tried: result.candidates_tried,
        started_from: Some(result.started_from.to_string()),
        source_conditioning: Some(position_conditioning(source, 0.0)),
        voxel_cell: Some(result.voxel_cell),
        rmse: None,
        max_error: None,
    };

    Some(RegistrationResult {
        matrix: result.matrix.0.to_vec(),
        stats: stats_json(&stats),
    })
}

/// Coarse stage alone, for callers that want the shortlist without paying for
/// refinement.
#[wasm_bindgen]
pub fn coarse_align(
    source: &[f32],
    target: &[f32],
    settings_json: &str,
) -> Option<RegistrationResult> {
    let settings: CoarseSettings = serde_json::from_str(settings_json).unwrap_or_default();
    let result = coarse_align_4dof(source, target, &settings.build())?;
    let stats = RegisterStats {
        coarse: Some(CoarseStats {
            yaw_degrees: result.best.yaw_degrees,
            score: result.best.score,
            runner_up_score: result.runner_up_score,
            candidates: result
                .candidates
                .iter()
                .map(|candidate| CoarseCandidateStats {
                    yaw_degrees: candidate.yaw_degrees,
                    score: candidate.score,
                    matrix: candidate.matrix.0.to_vec(),
                })
                .collect(),
        }),
        candidate_index: 0,
        candidates_tried: 0,
        ..Default::default()
    };
    Some(RegistrationResult {
        matrix: result.best.matrix.0.to_vec(),
        stats: stats_json(&stats),
    })
}

/// ICP refinement alone, from `settings.initial` (identity when absent).
#[wasm_bindgen]
pub fn icp_refine(
    source: &[f32],
    target: &[f32],
    settings_json: &str,
) -> Option<RegistrationResult> {
    let settings: IcpSettings = serde_json::from_str(settings_json).unwrap_or_default();
    let result = icp_point_to_plane(source, target, &settings.build())?;
    let stats = RegisterStats {
        icp: Some(IcpStats {
            iterations: result.iterations,
            inlier_count: result.inlier_count,
            inlier_rmse: result.inlier_rmse,
            fitness: result.fitness,
            converged: result.converged,
        }),
        voxel_cell: Some(
            settings
                .build()
                .voxel_size
                .unwrap_or_else(|| default_voxel_size(source, target)),
        ),
        candidate_index: -1,
        ..Default::default()
    };
    Some(RegistrationResult {
        matrix: result.matrix.0.to_vec(),
        stats: stats_json(&stats),
    })
}

/// Closed-form fit from matched correspondences.
#[wasm_bindgen]
pub fn fit_correspondences(source: &[f32], target: &[f32]) -> Option<RegistrationResult> {
    let fit = fit_rigid_transform(source, target)?;
    let stats = RegisterStats {
        candidate_index: -1,
        rmse: Some(fit.rmse),
        max_error: Some(fit.max_error),
        ..Default::default()
    };
    Some(RegistrationResult {
        matrix: fit.matrix.0.to_vec(),
        stats: stats_json(&stats),
    })
}

/// Smallest eigenvalue of a cloud's normalized normal-covariance, in [0, 1/3].
///
/// A caller ordering a multi-cloud alignment uses this to tell which clouds can
/// be placed from a blind search and which have to wait for a neighbour: see
/// `position_conditioning`.
#[wasm_bindgen]
pub fn cloud_position_conditioning(points: &[f32], cell: f64) -> f64 {
    position_conditioning(points, cell)
}
