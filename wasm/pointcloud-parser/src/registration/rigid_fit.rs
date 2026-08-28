//! Closed-form absolute orientation: the rigid transform that best maps a set
//! of source points onto their corresponding target points.
//!
//! Horn's unit-quaternion method rather than an SVD of the covariance. Both
//! give the same answer for well-posed input, but the quaternion form cannot
//! return a reflection, so there is no determinant fix-up branch to get wrong
//! when the user picks three nearly collinear correspondences.

use super::linalg::{symmetric_eigen, Mat4};

pub struct RigidFit {
    /// Maps source into target.
    pub matrix: Mat4,
    /// Root-mean-square residual over the correspondences, in scene units.
    pub rmse: f64,
    /// Largest single correspondence residual — the one to show the user.
    pub max_error: f64,
}

/// `source` and `target` are flat xyz triples of equal length, in matching
/// order. Returns `None` for fewer than three pairs, mismatched lengths, or a
/// degenerate configuration (all source points coincident).
pub fn fit_rigid_transform(source: &[f32], target: &[f32]) -> Option<RigidFit> {
    let count = source.len() / 3;
    if count < 3 || source.len() != target.len() || source.len() % 3 != 0 {
        return None;
    }

    let mut source_centroid = [0.0f64; 3];
    let mut target_centroid = [0.0f64; 3];
    for i in 0..count {
        for axis in 0..3 {
            source_centroid[axis] += source[i * 3 + axis] as f64;
            target_centroid[axis] += target[i * 3 + axis] as f64;
        }
    }
    for axis in 0..3 {
        source_centroid[axis] /= count as f64;
        target_centroid[axis] /= count as f64;
    }

    // Cross-covariance s[a][b] = sum source_a * target_b, mean-centred.
    let mut s = [0.0f64; 9];
    let mut source_spread = 0.0;
    for i in 0..count {
        let sv = [
            source[i * 3] as f64 - source_centroid[0],
            source[i * 3 + 1] as f64 - source_centroid[1],
            source[i * 3 + 2] as f64 - source_centroid[2],
        ];
        let tv = [
            target[i * 3] as f64 - target_centroid[0],
            target[i * 3 + 1] as f64 - target_centroid[1],
            target[i * 3 + 2] as f64 - target_centroid[2],
        ];
        source_spread += sv[0] * sv[0] + sv[1] * sv[1] + sv[2] * sv[2];
        for a in 0..3 {
            for b in 0..3 {
                s[a * 3 + b] += sv[a] * tv[b];
            }
        }
    }
    if !(source_spread > 0.0) {
        return None;
    }

    let (sxx, sxy, sxz) = (s[0], s[1], s[2]);
    let (syx, syy, syz) = (s[3], s[4], s[5]);
    let (szx, szy, szz) = (s[6], s[7], s[8]);
    // Horn's symmetric 4x4 profile matrix; its largest eigenvector is the
    // quaternion (w, x, y, z) of the optimal rotation.
    let n = [
        sxx + syy + szz,
        syz - szy,
        szx - sxz,
        sxy - syx,
        syz - szy,
        sxx - syy - szz,
        sxy + syx,
        szx + sxz,
        szx - sxz,
        sxy + syx,
        -sxx + syy - szz,
        syz + szy,
        sxy - syx,
        szx + sxz,
        syz + szy,
        -sxx - syy + szz,
    ];

    let (_, vectors) = symmetric_eigen::<4>(&n);
    let q = vectors[0];
    let length = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    if length < 1e-6 {
        return None;
    }
    let matrix = {
        let mut m =
            Mat4::from_quaternion([q[1] / length, q[2] / length, q[3] / length, q[0] / length]);
        let rotated = m.apply([
            source_centroid[0] as f32,
            source_centroid[1] as f32,
            source_centroid[2] as f32,
        ]);
        m.set_position(
            target_centroid[0] - rotated[0] as f64,
            target_centroid[1] - rotated[1] as f64,
            target_centroid[2] - rotated[2] as f64,
        );
        m
    };

    let mut squared_sum = 0.0;
    let mut max_error: f64 = 0.0;
    for i in 0..count {
        let moved = matrix.apply([source[i * 3], source[i * 3 + 1], source[i * 3 + 2]]);
        let dx = (moved[0] - target[i * 3]) as f64;
        let dy = (moved[1] - target[i * 3 + 1]) as f64;
        let dz = (moved[2] - target[i * 3 + 2]) as f64;
        let squared = dx * dx + dy * dy + dz * dz;
        squared_sum += squared;
        max_error = max_error.max(squared.sqrt());
    }

    Some(RigidFit {
        matrix,
        rmse: (squared_sum / count as f64).sqrt(),
        max_error,
    })
}
