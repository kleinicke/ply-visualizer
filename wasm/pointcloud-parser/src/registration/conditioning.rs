//! How well a cloud's own surfaces pin its position down.
//!
//! Point-to-plane registration can only feel motion *across* a surface, never
//! along it. A scan looking at one flat wall is therefore free to slide within
//! that wall at almost no cost in residual — and because sliding keeps every
//! point on the same wall, the apparent overlap can even rise as it does. That
//! makes the failure invisible to both numbers a caller would normally rank by.
//!
//! This measures the property directly and in advance, from the cloud alone:
//! sum the outer products of its surface normals and take the smallest
//! eigenvalue. The three eigenvalues sum to one, so a scan seeing surfaces in
//! every orientation lands near 0.33 and one dominated by a single plane leaves
//! a direction near zero.
//!
//! Measured on a nine-station archive the two populations do not overlap: the
//! clouds that can be placed from a blind yaw sweep score 0.125 to 0.190, and
//! the ones that slide score 0.006 to 0.032.

use std::collections::HashMap;

use super::linalg::symmetric_eigen;
use super::point_index::robust_extent;

/// Points per voxel below which a neighbourhood cannot describe a plane.
const MIN_PATCH_POINTS: usize = 12;

/// How flat a neighbourhood has to be to contribute a normal: the ratio of its
/// smallest to largest spread. Loose enough to accept real, noisy walls and
/// tight enough to reject the corners and clutter whose normals point anywhere.
const MAX_PATCH_FLATNESS: f64 = 0.06;

/// Neighbourhood size as a fraction of the cloud's own extent.
///
/// Patch size has to follow the scan, not a constant: a room and a quarry both
/// need neighbourhoods big enough to hold points and small enough to sit on one
/// surface, and those are different numbers in metres.
const EXTENT_TO_CELL: f64 = 1.0 / 50.0;

/// Smallest eigenvalue of the normalized normal-covariance, in `[0, 1/3]`.
///
/// `cell` is the neighbourhood size for the local plane fits, in scene units;
/// pass a non-positive value to derive it from the cloud's own extent. Returns
/// 0 when the cloud has no usable planar neighbourhood at all, which is the
/// honest answer: nothing here constrains a position.
pub fn position_conditioning(points: &[f32], cell: f64) -> f64 {
    let count = points.len() / 3;
    if count < MIN_PATCH_POINTS {
        return 0.0;
    }
    let cell = if cell > 0.0 {
        cell
    } else {
        (robust_extent(points, 100_000) * EXTENT_TO_CELL).max(1e-3)
    };

    let mut cells: HashMap<(i64, i64, i64), Vec<usize>> = HashMap::new();
    for index in 0..count {
        let key = (
            (points[index * 3] as f64 / cell).floor() as i64,
            (points[index * 3 + 1] as f64 / cell).floor() as i64,
            (points[index * 3 + 2] as f64 / cell).floor() as i64,
        );
        cells.entry(key).or_default().push(index);
    }

    let mut information = [0.0f64; 9];
    let mut patches = 0usize;
    for indices in cells.values() {
        if indices.len() < MIN_PATCH_POINTS {
            continue;
        }
        let inverse = 1.0 / indices.len() as f64;
        let mut centre = [0.0f64; 3];
        for &index in indices {
            for axis in 0..3 {
                centre[axis] += points[index * 3 + axis] as f64;
            }
        }
        for value in centre.iter_mut() {
            *value *= inverse;
        }

        let mut covariance = [0.0f64; 9];
        for &index in indices {
            let d = [
                points[index * 3] as f64 - centre[0],
                points[index * 3 + 1] as f64 - centre[1],
                points[index * 3 + 2] as f64 - centre[2],
            ];
            for row in 0..3 {
                for column in 0..3 {
                    covariance[row * 3 + column] += d[row] * d[column];
                }
            }
        }

        // Eigenvalues come back descending, vectors as rows, so the plane's
        // normal is the last row.
        let (values, vectors) = symmetric_eigen::<3>(&covariance);
        if values[0] <= 0.0 || values[2] / values[0] > MAX_PATCH_FLATNESS {
            continue;
        }
        let normal = vectors[2];
        let length = (normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]).sqrt();
        if length < 1e-12 {
            continue;
        }
        let n = [normal[0] / length, normal[1] / length, normal[2] / length];
        for row in 0..3 {
            for column in 0..3 {
                information[row * 3 + column] += n[row] * n[column];
            }
        }
        patches += 1;
    }

    if patches == 0 {
        return 0.0;
    }
    let inverse = 1.0 / patches as f64;
    for value in information.iter_mut() {
        *value *= inverse;
    }
    let (values, _) = symmetric_eigen::<3>(&information);
    values[2].max(0.0)
}
