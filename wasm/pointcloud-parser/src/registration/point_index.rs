//! Uniform-grid spatial index plus the two preprocessing steps ICP needs:
//! voxel downsampling and PCA normal estimation.
//!
//! A uniform grid rather than a KD-tree: after voxel downsampling the points
//! are close to uniformly dense, so bucketing is O(n) to build and a query
//! touches a fixed number of cells. Buckets are CSR-style (`cell_start` +
//! `items`) rather than a Vec per cell — a station scan downsamples to a few
//! hundred thousand points and one allocation per occupied cell is pure waste.

use std::collections::HashMap;

use super::linalg::symmetric_eigen;

/// Hash of a cell coordinate. FxHash-style multiply-xor rather than the
/// default SipHash: the keys are three small integers, lookups happen tens of
/// millions of times per solve, and cryptographic strength buys nothing here.
#[derive(Default, Clone, Copy)]
pub struct CellHasher(u64);

impl std::hash::Hasher for CellHasher {
    fn finish(&self) -> u64 {
        self.0
    }
    fn write(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.write_u64(byte as u64);
        }
    }
    fn write_i32(&mut self, value: i32) {
        self.write_u64(value as u32 as u64);
    }
    fn write_u64(&mut self, value: u64) {
        self.0 = (self.0 ^ value).wrapping_mul(0x517c_c1b7_2722_0a95);
    }
}

#[derive(Default, Clone, Copy)]
pub struct CellHasherBuilder;

impl std::hash::BuildHasher for CellHasherBuilder {
    type Hasher = CellHasher;
    fn build_hasher(&self) -> CellHasher {
        CellHasher(0xcbf2_9ce4_8422_2325)
    }
}

type CellKey = (i32, i32, i32);

/// Sparse uniform grid over occupied cells only.
///
/// A dense lattice was the obvious first implementation and it is the wrong one
/// for this data: a station scan's bounding box is set by a handful of
/// long-range returns (150 m on a real archive) while its useful structure sits
/// inside a few metres, so a lattice covering the box at the correspondence
/// gate's resolution needs billions of cells. Capping the cell count then
/// inflates the cell size until each one holds thousands of points and every
/// nearest-neighbour query degenerates into a linear scan — measured at 0.65 s
/// per ICP iteration before this changed. Hashing the occupied cells makes
/// empty space free, so the cell size can stay at the gate where it belongs.
pub struct PointGrid {
    pub points: Vec<f32>,
    cell_size: f64,
    /// Occupied cell -> its span in `items`.
    cells: HashMap<CellKey, (u32, u32), CellHasherBuilder>,
    items: Vec<u32>,
}

impl PointGrid {
    /// `points` is flat xyz triples, taken by value: an ICP run holds its grids
    /// for the whole solve, and a borrowed slice would make the cached scale
    /// levels in `icp.rs` self-referential for no gain.
    pub fn new(points: Vec<f32>, cell_size: f64) -> Self {
        let count = points.len() / 3;
        let size = cell_size.max(1e-6);

        // Sort point indices by cell, then hand each cell its contiguous span.
        let mut keyed: Vec<(CellKey, u32)> = Vec::with_capacity(count);
        for i in 0..count {
            keyed.push((
                cell_key(
                    points[i * 3] as f64,
                    points[i * 3 + 1] as f64,
                    points[i * 3 + 2] as f64,
                    size,
                ),
                i as u32,
            ));
        }
        keyed.sort_unstable_by_key(|entry| entry.0);

        let mut cells: HashMap<CellKey, (u32, u32), CellHasherBuilder> =
            HashMap::with_capacity_and_hasher(keyed.len() / 4 + 1, CellHasherBuilder);
        let mut items = Vec::with_capacity(count);
        let mut index = 0usize;
        while index < keyed.len() {
            let key = keyed[index].0;
            let start = items.len() as u32;
            while index < keyed.len() && keyed[index].0 == key {
                items.push(keyed[index].1);
                index += 1;
            }
            cells.insert(key, (start, items.len() as u32));
        }

        PointGrid {
            points,
            cell_size: size,
            cells,
            items,
        }
    }

    /// Visits every indexed point within `radius` of the query.
    fn for_each_near(
        &self,
        x: f64,
        y: f64,
        z: f64,
        radius: f64,
        mut visit: impl FnMut(usize, f64),
    ) {
        let ring = (radius / self.cell_size).ceil().max(1.0) as i32;
        let centre = cell_key(x, y, z, self.cell_size);
        let radius_sq = radius * radius;

        for iz in (centre.2 - ring)..=(centre.2 + ring) {
            for iy in (centre.1 - ring)..=(centre.1 + ring) {
                for ix in (centre.0 - ring)..=(centre.0 + ring) {
                    let Some(&(start, end)) = self.cells.get(&(ix, iy, iz)) else {
                        continue;
                    };
                    for &item in &self.items[start as usize..end as usize] {
                        let index = item as usize;
                        let dx = self.points[index * 3] as f64 - x;
                        let dy = self.points[index * 3 + 1] as f64 - y;
                        let dz = self.points[index * 3 + 2] as f64 - z;
                        let squared = dx * dx + dy * dy + dz * dz;
                        if squared <= radius_sq {
                            visit(index, squared);
                        }
                    }
                }
            }
        }
    }

    /// Index of the closest indexed point within `max_distance`, or `None`.
    ///
    /// Bounded on purpose: an ICP correspondence beyond the gate is rejected
    /// anyway, and the bound is what keeps the visited cell count constant.
    pub fn nearest(&self, x: f64, y: f64, z: f64, max_distance: f64) -> Option<usize> {
        let mut best = None;
        let mut best_sq = max_distance * max_distance;
        self.for_each_near(x, y, z, max_distance, |index, squared| {
            if squared < best_sq {
                best_sq = squared;
                best = Some(index);
            }
        });
        best
    }

    pub fn neighbors(
        &self,
        x: f64,
        y: f64,
        z: f64,
        radius: f64,
        limit: usize,
        out: &mut Vec<usize>,
    ) {
        out.clear();
        self.for_each_near(x, y, z, radius, |index, _| {
            if out.len() < limit {
                out.push(index);
            }
        });
    }
}

fn cell_key(x: f64, y: f64, z: f64, cell_size: f64) -> CellKey {
    (
        (x / cell_size).floor() as i32,
        (y / cell_size).floor() as i32,
        (z / cell_size).floor() as i32,
    )
}

/// Averages the points falling in each `voxel_size` cell down to one point.
///
/// Averaging rather than picking a representative: a station scan is far denser
/// near the scanner than at range, and keeping an arbitrary member of each cell
/// leaves that density gradient in the residual, biasing the fit toward
/// whatever is closest to the tripod.
pub fn voxel_downsample(points: &[f32], voxel_size: f64) -> Vec<f32> {
    let count = points.len() / 3;
    if count == 0 || !(voxel_size > 0.0) {
        return Vec::new();
    }
    let mut min = [f64::INFINITY; 3];
    for i in 0..count {
        for axis in 0..3 {
            min[axis] = min[axis].min(points[i * 3 + axis] as f64);
        }
    }

    let mut buckets: HashMap<(i64, i64, i64), (f64, f64, f64, u32)> = HashMap::new();
    for i in 0..count {
        let (x, y, z) = (
            points[i * 3] as f64,
            points[i * 3 + 1] as f64,
            points[i * 3 + 2] as f64,
        );
        if !x.is_finite() || !y.is_finite() || !z.is_finite() {
            continue;
        }
        let key = (
            ((x - min[0]) / voxel_size).floor() as i64,
            ((y - min[1]) / voxel_size).floor() as i64,
            ((z - min[2]) / voxel_size).floor() as i64,
        );
        let entry = buckets.entry(key).or_insert((0.0, 0.0, 0.0, 0));
        entry.0 += x;
        entry.1 += y;
        entry.2 += z;
        entry.3 += 1;
    }

    let mut out = Vec::with_capacity(buckets.len() * 3);
    // Sorted so the output order does not depend on hash iteration order:
    // a registration run has to be reproducible.
    let mut keys: Vec<_> = buckets.keys().copied().collect();
    keys.sort_unstable();
    for key in keys {
        let (sx, sy, sz, n) = buckets[&key];
        let n = n as f64;
        out.push((sx / n) as f32);
        out.push((sy / n) as f32);
        out.push((sz / n) as f32);
    }
    out
}

/// Evenly thins a point array to at most `max_points`.
pub fn stride_down(points: &[f32], max_points: usize) -> Vec<f32> {
    let count = points.len() / 3;
    if count <= max_points || max_points == 0 {
        return points.to_vec();
    }
    let step = count.div_ceil(max_points);
    let mut out = Vec::with_capacity((count / step + 1) * 3);
    let mut i = 0;
    while i < count {
        out.extend_from_slice(&points[i * 3..i * 3 + 3]);
        i += step;
    }
    out
}

/// Per-point surface normals from the smallest principal component of the
/// neighbourhood within `radius`.
///
/// Orientation is left arbitrary: point-to-plane ICP squares the plane
/// residual, so a flipped normal costs nothing, and orienting them
/// consistently across a scan is a much harder problem than the solver needs
/// solved. Points with too few neighbours get a zero normal, which `icp` reads
/// as "no usable plane here".
pub fn estimate_normals(grid: &PointGrid, radius: f64, min_neighbors: usize) -> Vec<f32> {
    let points = &grid.points;
    let count = points.len() / 3;
    let mut normals = vec![0.0f32; count * 3];
    let mut neighborhood: Vec<usize> = Vec::with_capacity(48);

    for i in 0..count {
        let (x, y, z) = (
            points[i * 3] as f64,
            points[i * 3 + 1] as f64,
            points[i * 3 + 2] as f64,
        );
        grid.neighbors(x, y, z, radius, 48, &mut neighborhood);
        if neighborhood.len() < min_neighbors {
            continue;
        }

        let n = neighborhood.len() as f64;
        let mut centre = [0.0f64; 3];
        for &index in &neighborhood {
            for axis in 0..3 {
                centre[axis] += points[index * 3 + axis] as f64;
            }
        }
        for value in centre.iter_mut() {
            *value /= n;
        }

        let (mut xx, mut xy, mut xz, mut yy, mut yz, mut zz) = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        for &index in &neighborhood {
            let dx = points[index * 3] as f64 - centre[0];
            let dy = points[index * 3 + 1] as f64 - centre[1];
            let dz = points[index * 3 + 2] as f64 - centre[2];
            xx += dx * dx;
            xy += dx * dy;
            xz += dx * dz;
            yy += dy * dy;
            yz += dy * dz;
            zz += dz * dz;
        }

        let (_, vectors) = symmetric_eigen::<3>(&[xx, xy, xz, xy, yy, yz, xz, yz, zz]);
        let normal = vectors[2];
        let length = (normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]).sqrt();
        if length > 1e-12 {
            for axis in 0..3 {
                normals[i * 3 + axis] = (normal[axis] / length) as f32;
            }
        }
    }
    normals
}

/// Robust working diameter of a cloud: twice the 90th-percentile distance from
/// its median centre.
///
/// The bounding box is the wrong scale reference for a station scan. Half the
/// points of a real scan sit within a few metres of the tripod while a thin
/// tail of long-range returns stretches the box to a hundred metres or more, so
/// any parameter derived from the box ends up an order of magnitude too coarse
/// for the geometry two stations actually share.
pub fn robust_extent(points: &[f32], max_samples: usize) -> f64 {
    let count = points.len() / 3;
    if count == 0 {
        return 0.0;
    }
    let stride = count.div_ceil(max_samples.max(1)).max(1);
    let mut axes: [Vec<f64>; 3] = [Vec::new(), Vec::new(), Vec::new()];
    let mut i = 0;
    while i < count {
        for axis in 0..3 {
            axes[axis].push(points[i * 3 + axis] as f64);
        }
        i += stride;
    }

    let mut centre = [0.0f64; 3];
    for axis in 0..3 {
        let mut sorted = axes[axis].clone();
        sorted.sort_by(f64::total_cmp);
        centre[axis] = sorted[sorted.len() / 2];
    }

    let mut radii: Vec<f64> = (0..axes[0].len())
        .map(|k| {
            let dx = axes[0][k] - centre[0];
            let dy = axes[1][k] - centre[1];
            let dz = axes[2][k] - centre[2];
            (dx * dx + dy * dy + dz * dz).sqrt()
        })
        .collect();
    radii.sort_by(f64::total_cmp);
    (radii[(radii.len() as f64 * 0.9) as usize] * 2.0).max(1e-6)
}
