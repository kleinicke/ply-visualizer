//! 4-DoF coarse alignment for terrestrial scans: yaw sweep + FFT phase
//! correlation for the horizontal shift, 1-D correlation for the vertical one.
//!
//! The reason automatic alignment is affordable at all is that the search is
//! not 6-DoF. A tripod scanner levels itself with a dual-axis compensator, so
//! two stations of the same site differ by a yaw and a translation, and roll
//! and pitch are already correct to within a fraction of a degree. That
//! collapses global registration from "match 3-D features and RANSAC a pose"
//! to "try every yaw and let the FFT hand you the best translation for each" —
//! no descriptors, no correspondences, no random sampling, deterministic.
//!
//! The output is a coarse pose, meant to be handed straight to `icp`.

use super::fft::fft2d;
use super::linalg::Mat4;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum UpAxis {
    X,
    Y,
    Z,
}

impl UpAxis {
    pub fn from_str(value: &str) -> UpAxis {
        match value {
            "x" | "X" => UpAxis::X,
            "y" | "Y" => UpAxis::Y,
            _ => UpAxis::Z,
        }
    }

    /// `(up, first horizontal, second horizontal)`, cyclic so a positive angle
    /// in the horizontal plane is a right-handed rotation about the up axis.
    fn axes(self) -> [usize; 3] {
        match self {
            UpAxis::X => [0, 1, 2],
            UpAxis::Y => [1, 2, 0],
            UpAxis::Z => [2, 0, 1],
        }
    }

    fn vector(self) -> [f64; 3] {
        match self {
            UpAxis::X => [1.0, 0.0, 0.0],
            UpAxis::Y => [0.0, 1.0, 0.0],
            UpAxis::Z => [0.0, 0.0, 1.0],
        }
    }
}

/// What each top-down raster cell measures.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RasterFeature {
    /// Vertical extent of the cell: walls, poles and building edges light up,
    /// flat ground contributes nothing. The default, because ground is most of
    /// what a terrestrial scan sees and it looks identical everywhere, so a
    /// density raster of an outdoor site correlates almost as well at the wrong
    /// yaw as at the right one.
    Verticality,
    /// Log-compressed point count. The log matters: raw counts are dominated by
    /// the ring of extreme density right around the tripod, which carries no
    /// information about where the station stood.
    Density,
}

impl RasterFeature {
    pub fn from_str(value: &str) -> RasterFeature {
        match value {
            "density" => RasterFeature::Density,
            _ => RasterFeature::Verticality,
        }
    }
}

pub struct CoarseOptions {
    pub up_axis: UpAxis,
    pub resolution: usize,
    pub yaw_step_degrees: f64,
    pub max_samples: usize,
    pub feature: RasterFeature,
    pub candidate_count: usize,
    /// Translation peaks kept per yaw. 1 reproduces the original behaviour.
    pub peaks_per_yaw: usize,
    /// Correlation window as a multiple of the larger cloud's span.
    ///
    /// This is the search range for translation, and it is easy to make too
    /// small without noticing. The stage pre-centres one cloud's median on the
    /// other's, but a scan's median sits on its own axis at roughly its mean
    /// range, so for two scans of one room the pre-shift is near zero whatever
    /// the instrument positions were — it carries no information about them.
    /// The whole station offset therefore has to come out of the correlation,
    /// and anything beyond half the window aliases rather than being found.
    pub window_factor: f64,
}

impl Default for CoarseOptions {
    fn default() -> Self {
        CoarseOptions {
            up_axis: UpAxis::Z,
            resolution: 128,
            yaw_step_degrees: 5.0,
            max_samples: 200_000,
            feature: RasterFeature::Verticality,
            candidate_count: 5,
            peaks_per_yaw: 1,
            window_factor: 1.5,
        }
    }
}

#[derive(Clone, Copy)]
pub struct CoarseCandidate {
    /// Maps source into target; rotation is pure yaw about the up axis.
    pub matrix: Mat4,
    pub yaw_degrees: f64,
    /// Normalized phase-correlation peak. A confidence, only meaningful next to
    /// the other candidates: what matters is how far the winner stands above
    /// the runner-up, not its absolute height.
    pub score: f64,
}

pub struct CoarseResult {
    pub best: CoarseCandidate,
    pub runner_up_score: f64,
    /// The best separated yaw peaks, strongest first, `candidates[0]` being
    /// `best`. Reported because on real scans the sweep is often close to
    /// ambiguous, and handing the shortlist to ICP is far more reliable than
    /// trusting the top peak.
    pub candidates: Vec<CoarseCandidate>,
}

#[derive(Clone, Copy)]
struct Hypothesis {
    yaw_degrees: f64,
    shift_a: i64,
    shift_b: i64,
    peak: f64,
}

fn sample_stride(point_count: usize, max_samples: usize) -> usize {
    point_count.div_ceil(max_samples.max(1)).max(1)
}

/// Accumulates points into an `n x n` top-down raster, log-compressed and
/// mean-removed. Removing the mean keeps the DC term from planting a spurious
/// peak at zero shift.
#[allow(clippy::too_many_arguments)]
fn rasterize(
    points: &[f32],
    axes: [usize; 3],
    angle: f64,
    center: [f64; 3],
    origin_a: f64,
    origin_b: f64,
    cell: f64,
    n: usize,
    stride: usize,
    feature: RasterFeature,
) -> Vec<f64> {
    let (up_index, axis_a, axis_b) = (axes[0], axes[1], axes[2]);
    let mut grid = vec![0.0f64; n * n];
    let (cos, sin) = (angle.cos(), angle.sin());
    let count = points.len() / 3;

    let vertical = feature == RasterFeature::Verticality;
    let mut min_up = if vertical {
        vec![f64::INFINITY; n * n]
    } else {
        Vec::new()
    };
    let mut max_up = if vertical {
        vec![f64::NEG_INFINITY; n * n]
    } else {
        Vec::new()
    };

    let mut i = 0;
    while i < count {
        let a = points[i * 3 + axis_a] as f64 - center[axis_a];
        let b = points[i * 3 + axis_b] as f64 - center[axis_b];
        let rotated_a = cos * a - sin * b + center[axis_a];
        let rotated_b = sin * a + cos * b + center[axis_b];
        let ia = ((rotated_a - origin_a) / cell).floor();
        let ib = ((rotated_b - origin_b) / cell).floor();
        if ia >= 0.0 && ia < n as f64 && ib >= 0.0 && ib < n as f64 {
            let index = ib as usize * n + ia as usize;
            if vertical {
                let up = points[i * 3 + up_index] as f64;
                min_up[index] = min_up[index].min(up);
                max_up[index] = max_up[index].max(up);
            } else {
                grid[index] += 1.0;
            }
        }
        i += stride;
    }

    let mut sum = 0.0;
    for (index, value) in grid.iter_mut().enumerate() {
        *value = if vertical {
            if max_up[index] > min_up[index] {
                (max_up[index] - min_up[index]).ln_1p()
            } else {
                0.0
            }
        } else {
            value.ln_1p()
        };
        sum += *value;
    }
    let mean = sum / grid.len() as f64;
    for value in grid.iter_mut() {
        *value -= mean;
    }
    grid
}

/// Phase correlation of `source` against a pre-transformed target spectrum.
///
/// Returns up to `wanted` separated peaks, strongest first: the integer cell
/// shift to *add* to the source to land on the target, and the peak height.
///
/// More than one matters because the surface is genuinely multimodal. A scan
/// pair in a room with repeated structure produces several translations that
/// explain the overlap about equally well, and keeping only the tallest throws
/// away hypotheses a later, better-informed stage could have chosen between.
/// The extra peaks are nearly free: the transform is already computed.
fn correlate_peaks(
    source: &[f64],
    target_re: &[f64],
    target_im: &[f64],
    n: usize,
    wanted: usize,
) -> Vec<(i64, i64, f64)> {
    let mut re = source.to_vec();
    let mut im = vec![0.0f64; n * n];
    fft2d(&mut re, &mut im, n, false);

    // conj(S) * T, magnitude-normalized. Keeping only the phase is what makes
    // the peak sharp and the result insensitive to one scan simply having more
    // points than the other; this conjugation order puts the peak at the shift
    // to apply, rather than its negation.
    for i in 0..re.len() {
        let cr = re[i] * target_re[i] + im[i] * target_im[i];
        let ci = re[i] * target_im[i] - im[i] * target_re[i];
        let magnitude = (cr * cr + ci * ci).sqrt();
        if magnitude > 1e-12 {
            re[i] = cr / magnitude;
            im[i] = ci / magnitude;
        } else {
            re[i] = 0.0;
            im[i] = 0.0;
        }
    }
    fft2d(&mut re, &mut im, n, true);

    // A peak past the halfway point is a negative shift wrapped around by the
    // transform's periodicity.
    let half = (n / 2) as i64;
    let unwrap = |raw: i64| if raw > half { raw - n as i64 } else { raw };
    // Peaks must be separated, or the cells around the tallest come back as
    // "alternatives" and the shortlist describes a single hypothesis.
    let separation = (n as i64 / 16).max(3);

    let mut found: Vec<(i64, i64, f64)> = Vec::with_capacity(wanted.max(1));
    let mut order: Vec<usize> = (0..re.len()).collect();
    order.sort_by(|&x, &y| re[y].total_cmp(&re[x]));
    for index in order {
        if found.len() >= wanted.max(1) {
            break;
        }
        let a = unwrap((index % n) as i64);
        let b = unwrap((index / n) as i64);
        if found
            .iter()
            .any(|&(fa, fb, _)| (fa - a).abs() <= separation && (fb - b).abs() <= separation)
        {
            continue;
        }
        found.push((a, b, re[index]));
    }
    found
}

/// Robust centre and working extent of a cloud, seen from above. Percentiles
/// rather than the mean and the bounding box — see `robust_extent`.
fn horizontal_centroid_and_span(
    points: &[f32],
    axes: [usize; 3],
    stride: usize,
) -> ([f64; 3], f64) {
    let count = points.len() / 3;
    let (up_index, axis_a, axis_b) = (axes[0], axes[1], axes[2]);
    let (mut samples_a, mut samples_b, mut samples_up) = (Vec::new(), Vec::new(), Vec::new());
    let mut i = 0;
    while i < count {
        samples_a.push(points[i * 3 + axis_a] as f64);
        samples_b.push(points[i * 3 + axis_b] as f64);
        samples_up.push(points[i * 3 + up_index] as f64);
        i += stride;
    }
    if samples_a.is_empty() {
        return ([0.0; 3], 1.0);
    }

    let median = |values: &[f64]| {
        let mut sorted = values.to_vec();
        sorted.sort_by(f64::total_cmp);
        sorted[sorted.len() / 2]
    };
    let centre_a = median(&samples_a);
    let centre_b = median(&samples_b);

    let mut radii: Vec<f64> = samples_a
        .iter()
        .zip(&samples_b)
        .map(|(&a, &b)| ((a - centre_a).powi(2) + (b - centre_b).powi(2)).sqrt())
        .collect();
    radii.sort_by(f64::total_cmp);
    let percentile90 = radii[(radii.len() as f64 * 0.9) as usize];

    let mut centroid = [0.0f64; 3];
    centroid[axis_a] = centre_a;
    centroid[axis_b] = centre_b;
    centroid[up_index] = median(&samples_up);
    (centroid, (percentile90 * 2.0).max(1e-3))
}

/// Best vertical offset from a direct correlation of the two height histograms.
fn estimate_vertical_shift(
    source: &[f32],
    target: &[f32],
    up_index: usize,
    bin_size: f64,
    stride: usize,
) -> f64 {
    let gather = |points: &[f32]| {
        let count = points.len() / 3;
        let mut values = Vec::new();
        let mut i = 0;
        while i < count {
            values.push(points[i * 3 + up_index] as f64);
            i += stride;
        }
        values
    };
    let source_values = gather(source);
    let target_values = gather(target);
    if source_values.is_empty() || target_values.is_empty() {
        return 0.0;
    }

    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for values in [&source_values, &target_values] {
        for &value in values {
            min = min.min(value);
            max = max.max(value);
        }
    }
    let bins = (((max - min) / bin_size).ceil() as usize + 1).clamp(8, 2048);
    let width = {
        let w = (max - min) / bins as f64;
        if w > 0.0 {
            w
        } else {
            1.0
        }
    };

    let histogram = |values: &[f64]| {
        let mut out = vec![0.0f64; bins];
        for &value in values {
            let bin = (((value - min) / width).floor() as isize).clamp(0, bins as isize - 1);
            out[bin as usize] += 1.0;
        }
        let mut sum = 0.0;
        for value in out.iter_mut() {
            *value = value.ln_1p();
            sum += *value;
        }
        let mean = sum / bins as f64;
        for value in out.iter_mut() {
            *value -= mean;
        }
        out
    };
    let source_histogram = histogram(&source_values);
    let target_histogram = histogram(&target_values);

    let max_lag = (bins / 2) as isize;
    let mut best_lag = 0isize;
    let mut best_score = f64::NEG_INFINITY;
    for lag in -max_lag..=max_lag {
        let mut score = 0.0;
        for i in 0..bins {
            let j = i as isize + lag;
            if j >= 0 && (j as usize) < bins {
                score += source_histogram[i] * target_histogram[j as usize];
            }
        }
        if score > best_score {
            best_score = score;
            best_lag = lag;
        }
    }
    best_lag as f64 * width
}

/// `source` and `target` are flat xyz triples, already in world space.
pub fn coarse_align_4dof(
    source: &[f32],
    target: &[f32],
    options: &CoarseOptions,
) -> Option<CoarseResult> {
    let n = options.resolution;
    if !n.is_power_of_two() || n < 16 || source.len() < 9 || target.len() < 9 {
        return None;
    }

    let axes = options.up_axis.axes();
    let (up_index, axis_a, axis_b) = (axes[0], axes[1], axes[2]);
    let source_stride = sample_stride(source.len() / 3, options.max_samples);
    let target_stride = sample_stride(target.len() / 3, options.max_samples);

    let (source_centroid, source_span) = horizontal_centroid_and_span(source, axes, source_stride);
    let (target_centroid, target_span) = horizontal_centroid_and_span(target, axes, target_stride);

    // Half again as wide as the larger cloud, so a shift of up to three
    // quarters of a cloud's extent stays inside the transform's unambiguous
    // range instead of aliasing around it.
    let window = source_span.max(target_span) * options.window_factor.max(1.0);
    let cell = window / n as f64;
    let origin_a = target_centroid[axis_a] - window / 2.0;
    let origin_b = target_centroid[axis_b] - window / 2.0;

    // The source is pre-centred on the target so the sweep only has to explain
    // the residual offset, keeping the search inside that window.
    let mut pre_shift = [0.0f64; 3];
    pre_shift[axis_a] = target_centroid[axis_a] - source_centroid[axis_a];
    pre_shift[axis_b] = target_centroid[axis_b] - source_centroid[axis_b];
    let mut rotation_center = source_centroid;
    rotation_center[axis_a] += pre_shift[axis_a];
    rotation_center[axis_b] += pre_shift[axis_b];

    let mut shifted_source = vec![0.0f32; source.len()];
    for i in (0..source.len()).step_by(3) {
        for axis in 0..3 {
            shifted_source[i + axis] = points_add(source[i + axis], pre_shift[axis]);
        }
    }

    let target_grid = rasterize(
        target,
        axes,
        0.0,
        target_centroid,
        origin_a,
        origin_b,
        cell,
        n,
        target_stride,
        options.feature,
    );
    let mut target_re = target_grid;
    let mut target_im = vec![0.0f64; n * n];
    fft2d(&mut target_re, &mut target_im, n, false);

    let evaluate_peaks = |yaw_degrees: f64, wanted: usize| -> Vec<Hypothesis> {
        let grid = rasterize(
            &shifted_source,
            axes,
            yaw_degrees.to_radians(),
            rotation_center,
            origin_a,
            origin_b,
            cell,
            n,
            source_stride,
            options.feature,
        );
        correlate_peaks(&grid, &target_re, &target_im, n, wanted)
            .into_iter()
            .map(|(shift_a, shift_b, peak)| Hypothesis {
                yaw_degrees,
                shift_a,
                shift_b,
                peak,
            })
            .collect()
    };
    let evaluate = |yaw_degrees: f64| -> Hypothesis {
        evaluate_peaks(yaw_degrees, 1)
            .into_iter()
            .next()
            .unwrap_or(Hypothesis {
                yaw_degrees,
                shift_a: 0,
                shift_b: 0,
                peak: f64::NEG_INFINITY,
            })
    };

    let peaks = options.peaks_per_yaw.max(1);
    let mut sweep: Vec<Hypothesis> = Vec::new();
    let mut yaw = 0.0;
    while yaw < 360.0 {
        sweep.extend(evaluate_peaks(yaw, peaks));
        yaw += options.yaw_step_degrees;
    }
    sweep.sort_by(|x, y| y.peak.total_cmp(&x.peak));

    let angular_distance = |x: f64, y: f64| {
        let difference = (x - y).rem_euclid(360.0);
        difference.min(360.0 - difference)
    };

    // Several yaws either side of one peak are the same hypothesis; keep only
    // separated ones so the shortlist holds genuinely different guesses.
    // Two hypotheses are the same guess only if they agree about the yaw *and*
    // the translation. Keeping more than one peak per yaw makes that
    // distinction load-bearing: the flip of a room and its true pose can share
    // a yaw and differ entirely in where the station stood.
    let shift_separation = (n as i64 / 16).max(3);
    let mut distinct: Vec<Hypothesis> = Vec::new();
    for hypothesis in &sweep {
        if distinct.iter().all(|kept| {
            angular_distance(kept.yaw_degrees, hypothesis.yaw_degrees) > options.yaw_step_degrees
                || (kept.shift_a - hypothesis.shift_a).abs() > shift_separation
                || (kept.shift_b - hypothesis.shift_b).abs() > shift_separation
        }) {
            distinct.push(*hypothesis);
        }
        if distinct.len() >= options.candidate_count.max(1) {
            break;
        }
    }

    // Refine each survivor to one degree. Cheap next to the full sweep, and it
    // hands ICP starts already inside its convergence basin.
    let mut refined: Vec<Hypothesis> = distinct
        .iter()
        .map(|hypothesis| {
            let mut best = *hypothesis;
            let step = options.yaw_step_degrees as i64;
            for offset in (-step + 1)..step {
                if offset == 0 {
                    continue;
                }
                // Only peaks belonging to *this* hypothesis: at a neighbouring
                // yaw the tallest peak may be a different mode entirely, and
                // following it turns a refinement into a silent jump.
                for candidate in evaluate_peaks(hypothesis.yaw_degrees + offset as f64, peaks) {
                    if candidate.peak > best.peak
                        && (candidate.shift_a - hypothesis.shift_a).abs() <= shift_separation
                        && (candidate.shift_b - hypothesis.shift_b).abs() <= shift_separation
                    {
                        best = candidate;
                    }
                }
            }
            best
        })
        .collect();
    refined.sort_by(|x, y| y.peak.total_cmp(&x.peak));

    let up_vector = options.up_axis.vector();
    let build_pose = |hypothesis: &Hypothesis| -> CoarseCandidate {
        let angle = hypothesis.yaw_degrees.to_radians();
        let mut residual = [0.0f64; 3];
        residual[axis_a] = hypothesis.shift_a as f64 * cell;
        residual[axis_b] = hypothesis.shift_b as f64 * cell;

        // p -> p + pre_shift -> yaw about the shifted centre -> + residual.
        let centre = rotation_center;
        let mut matrix = Mat4::translation(pre_shift[0], pre_shift[1], pre_shift[2]);
        matrix = Mat4::translation(-centre[0], -centre[1], -centre[2]).multiply(&matrix);
        matrix = Mat4::rotation_axis(up_vector, angle).multiply(&matrix);
        matrix = Mat4::translation(centre[0], centre[1], centre[2]).multiply(&matrix);
        matrix = Mat4::translation(residual[0], residual[1], residual[2]).multiply(&matrix);

        // The vertical offset is estimated on the horizontally aligned clouds,
        // so the histograms describe the same structures.
        let mut aligned = vec![0.0f32; source.len()];
        for i in (0..source.len()).step_by(3) {
            let moved = matrix.apply([source[i], source[i + 1], source[i + 2]]);
            aligned[i..i + 3].copy_from_slice(&moved);
        }
        let vertical_shift =
            estimate_vertical_shift(&aligned, target, up_index, cell, source_stride);
        matrix = Mat4::translation(
            up_vector[0] * vertical_shift,
            up_vector[1] * vertical_shift,
            up_vector[2] * vertical_shift,
        )
        .multiply(&matrix);

        CoarseCandidate {
            matrix,
            yaw_degrees: hypothesis.yaw_degrees.rem_euclid(360.0),
            score: hypothesis.peak,
        }
    };

    let candidates: Vec<CoarseCandidate> = refined.iter().map(build_pose).collect();
    Some(CoarseResult {
        best: candidates[0],
        runner_up_score: refined.get(1).map(|h| h.peak).unwrap_or(0.0),
        candidates,
    })
}

fn points_add(value: f32, offset: f64) -> f32 {
    (value as f64 + offset) as f32
}
