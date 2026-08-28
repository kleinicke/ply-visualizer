//! Marching cubes over a scalar volume.
//!
//! Ported from `engine/src/visualization/marchingCubes.ts`, which stays as the
//! thin wrapper that hands the volume over and turns the result into a
//! `BufferGeometry`. Everything numerical is here.
//!
//! Output is in the volume's declared world space, not in voxel indices,
//! because a mesh whose coordinates are array subscripts cannot be measured
//! against anything else in the scene.
//!
//! The extraction runs to completion in one call. The TypeScript it replaces
//! was a generator that yielded per k-layer, which existed only so a
//! single-threaded page could stay responsive; the isosurface is extracted in
//! the extension host, which is its own process, so there is nothing to yield
//! to.

mod nrrd;
mod tables;
mod voxels;

pub use nrrd::{parse_nrrd, NrrdVolume};
pub use voxels::{build_volume_voxels, VoxelMesh};

use tables::{CORNER_OFFSETS, EDGE_CORNERS, TRI_TABLE};
use wasm_bindgen::prelude::*;

/// Which edges a configuration cuts, derived from `TRI_TABLE` so the two cannot
/// disagree — the same reasoning the TypeScript tables file gives.
fn edge_mask(cube_index: usize) -> u32 {
    let mut mask = 0u32;
    for &edge in TRI_TABLE[cube_index] {
        if edge >= 0 {
            mask |= 1 << edge;
        }
    }
    mask
}

/// A triangle mesh, ready for a `BufferGeometry`.
#[wasm_bindgen]
#[cfg_attr(test, derive(Debug))]
pub struct IsosurfaceMesh {
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
    gradient_magnitudes: Vec<f32>,
    vertex_count: u32,
    triangle_count: u32,
    step: Vec<u32>,
}

#[wasm_bindgen]
impl IsosurfaceMesh {
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }
    #[wasm_bindgen(getter)]
    pub fn triangle_count(&self) -> u32 {
        self.triangle_count
    }
    /// The decimation actually used, so callers can report what they rendered.
    #[wasm_bindgen(getter)]
    pub fn step(&self) -> Vec<u32> {
        self.step.clone()
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.positions)
    }
    pub fn take_normals(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.normals)
    }
    pub fn take_indices(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.indices)
    }
    pub fn take_gradient_magnitudes(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.gradient_magnitudes)
    }
}

/// Central-difference gradient in voxel-index space, one-sided at the border.
///
/// Coordinates arrive in decimated grid units; differencing over the same step
/// the surface was built at keeps the gradient consistent with the geometry
/// instead of picking up noise the decimation already discarded.
#[allow(clippy::too_many_arguments)]
fn gradient_at(
    samples: &[f32],
    sizes: [usize; 3],
    a: usize,
    b: usize,
    c: usize,
    step: [usize; 3],
) -> [f64; 3] {
    let [nx, ny, nz] = sizes;
    let [sx, sy, sz] = step;
    let i = a * sx;
    let j = b * sy;
    let k = c * sz;
    let stride_y = nx;
    let stride_z = nx * ny;
    let sample =
        |x: usize, y: usize, z: usize| -> f64 { samples[x + y * stride_y + z * stride_z] as f64 };

    let x_low = i.saturating_sub(sx);
    let x_high = (i + sx).min(nx - 1);
    let y_low = j.saturating_sub(sy);
    let y_high = (j + sy).min(ny - 1);
    let z_low = k.saturating_sub(sz);
    let z_high = (k + sz).min(nz - 1);

    [
        (sample(x_high, j, k) - sample(x_low, j, k)) / (x_high - x_low).max(1) as f64,
        (sample(i, y_high, k) - sample(i, y_low, k)) / (y_high - y_low).max(1) as f64,
        (sample(i, j, z_high) - sample(i, j, z_low)) / (z_high - z_low).max(1) as f64,
    ]
}

/// Inverse transpose of the upper-left 3x3 of a row-major 4x4.
///
/// Gradients need this rather than the affine itself: under a non-uniform or
/// oblique voxel grid — which oblique DICOM always is — a normal transformed by
/// the affine is wrong and the shading visibly skews.
fn inverse_transpose3(m: &[f64]) -> [f64; 9] {
    let (a, b, c) = (m[0], m[1], m[2]);
    let (d, e, f) = (m[4], m[5], m[6]);
    let (g, h, i) = (m[8], m[9], m[10]);

    let determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if determinant.abs() < 1e-20 {
        // Degenerate affine (a zero-thickness axis). Shading will be wrong but
        // the positions are still meaningful, so fall through with identity
        // rather than failing the whole load.
        return [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
    }
    let inv = 1.0 / determinant;
    [
        (e * i - f * h) * inv,
        (f * g - d * i) * inv,
        (d * h - e * g) * inv,
        (c * h - b * i) * inv,
        (a * i - c * g) * inv,
        (b * g - a * h) * inv,
        (b * f - c * e) * inv,
        (c * d - a * f) * inv,
        (a * e - b * d) * inv,
    ]
}

/// Extract an isosurface at `threshold`.
///
/// `sizes` is the volume's (nx, ny, nz); `ijk_to_world` is its row-major 4x4;
/// `step` is the per-axis decimation, which the caller has already chosen.
#[wasm_bindgen]
pub fn extract_isosurface(
    samples: &[f32],
    sizes: &[u32],
    ijk_to_world: &[f64],
    threshold: f64,
    step: &[u32],
    max_triangles: u32,
) -> Result<IsosurfaceMesh, JsValue> {
    extract_isosurface_inner(samples, sizes, ijk_to_world, threshold, step, max_triangles)
        .map_err(|error| JsValue::from_str(&error))
}

fn extract_isosurface_inner(
    samples: &[f32],
    sizes: &[u32],
    ijk_to_world: &[f64],
    threshold: f64,
    step: &[u32],
    max_triangles: u32,
) -> Result<IsosurfaceMesh, String> {
    if sizes.len() < 3 || ijk_to_world.len() < 12 || step.len() < 3 {
        return Err("isosurface needs 3 sizes, 3 steps and a 4x4 affine".into());
    }
    let volume_sizes = [sizes[0] as usize, sizes[1] as usize, sizes[2] as usize];
    let [nx, ny, nz] = volume_sizes;
    if samples.len() < nx * ny * nz {
        return Err(format!(
            "volume has {} samples, expected {}",
            samples.len(),
            nx * ny * nz
        ));
    }
    let decimation = [
        (step[0] as usize).max(1),
        (step[1] as usize).max(1),
        (step[2] as usize).max(1),
    ];
    let [sx, sy, sz] = decimation;

    // Grid of sampled points after decimation.
    let gx = (nx - 1) / sx + 1;
    let gy = (ny - 1) / sy + 1;
    let gz = (nz - 1) / sz + 1;
    if gx < 2 || gy < 2 || gz < 2 {
        return Err(format!(
            "Volume is too small to isosurface at step {}x{}x{} ({gx}x{gy}x{gz} sample grid)",
            sx, sy, sz
        ));
    }

    let stride_y = nx;
    let stride_z = nx * ny;
    let at = |a: usize, b: usize, c: usize| -> f64 {
        samples[a * sx + b * sy * stride_y + c * sz * stride_z] as f64
    };

    let mut positions: Vec<f32> = Vec::new();
    let mut normals: Vec<f32> = Vec::new();
    let mut gradient_magnitudes: Vec<f32> = Vec::new();
    let mut indices: Vec<u32> = Vec::new();

    // Edge-vertex cache. Each sampled grid point owns up to three edges - the
    // ones leaving it along +i, +j and +k - so an edge shared by up to four
    // cells produces exactly one vertex. Only two k-layers are ever live, which
    // is what keeps peak memory proportional to a slice rather than the volume.
    let layer_size = gx * gy * 3;
    let mut current = vec![-1i32; layer_size];
    let mut next = vec![-1i32; layer_size];

    let normal_matrix = inverse_transpose3(ijk_to_world);
    let m = ijk_to_world;
    let mut corner_values = [0f64; 8];
    let mut edge_vertices = [0u32; 12];

    for c in 0..gz - 1 {
        for b in 0..gy - 1 {
            for a in 0..gx - 1 {
                let mut cube_index = 0usize;
                for corner in 0..8 {
                    let [di, dj, dk] = CORNER_OFFSETS[corner];
                    let value = at(a + di, b + dj, c + dk);
                    corner_values[corner] = value;
                    // `>=` rather than `>`: a sample exactly at the threshold
                    // counts as inside, so a volume of constant value never
                    // yields a surface riddled with degenerate triangles.
                    if value >= threshold {
                        cube_index |= 1 << corner;
                    }
                }

                let edges = edge_mask(cube_index);
                if edges == 0 {
                    continue;
                }

                for edge in 0..12usize {
                    if edges & (1 << edge) == 0 {
                        continue;
                    }
                    let [c0, c1] = EDGE_CORNERS[edge];
                    let [i0, j0, k0] = CORNER_OFFSETS[c0];
                    let [i1, j1, k1] = CORNER_OFFSETS[c1];

                    // The edge is owned by its lower-numbered endpoint, along
                    // whichever axis it runs.
                    let axis = if i0 != i1 {
                        0
                    } else if j0 != j1 {
                        1
                    } else {
                        2
                    };
                    let oa = a + i0.min(i1);
                    let ob = b + j0.min(j1);
                    let ok = c + k0.min(k1);
                    let slot = (oa + ob * gx) * 3 + axis;
                    let on_current_layer = ok == c;

                    let cached = if on_current_layer {
                        current[slot]
                    } else {
                        next[slot]
                    };
                    let vertex_index = if cached >= 0 {
                        cached as u32
                    } else {
                        let v0 = corner_values[c0];
                        let v1 = corner_values[c1];
                        // Linear interpolation to the crossing. The guard
                        // matters: equal endpoint values mean the crossing is
                        // undefined, and dividing through would emit NaN
                        // positions that poison the bounding box.
                        let denominator = v1 - v0;
                        let t = if denominator.abs() > 1e-12 {
                            (threshold - v0) / denominator
                        } else {
                            0.5
                        };

                        let ga = a as f64 + i0 as f64 + (i1 as f64 - i0 as f64) * t;
                        let gb = b as f64 + j0 as f64 + (j1 as f64 - j0 as f64) * t;
                        let gc = c as f64 + k0 as f64 + (k1 as f64 - k0 as f64) * t;

                        // Grid coordinates are decimated; the affine is in
                        // original voxel indices, so scale back before
                        // transforming.
                        let vi = ga * sx as f64;
                        let vj = gb * sy as f64;
                        let vk = gc * sz as f64;
                        positions.push((m[0] * vi + m[1] * vj + m[2] * vk + m[3]) as f32);
                        positions.push((m[4] * vi + m[5] * vj + m[6] * vk + m[7]) as f32);
                        positions.push((m[8] * vi + m[9] * vj + m[10] * vk + m[11]) as f32);

                        let g0 =
                            gradient_at(samples, volume_sizes, a + i0, b + j0, c + k0, decimation);
                        let g1 =
                            gradient_at(samples, volume_sizes, a + i1, b + j1, c + k1, decimation);
                        // Negated: the field increases inwards (denser tissue
                        // is brighter), so the outward normal follows the
                        // decreasing gradient.
                        let nxg = -(g0[0] + (g1[0] - g0[0]) * t);
                        let nyg = -(g0[1] + (g1[1] - g0[1]) * t);
                        let nzg = -(g0[2] + (g1[2] - g0[2]) * t);

                        let mut wx = normal_matrix[0] * nxg
                            + normal_matrix[1] * nyg
                            + normal_matrix[2] * nzg;
                        let mut wy = normal_matrix[3] * nxg
                            + normal_matrix[4] * nyg
                            + normal_matrix[5] * nzg;
                        let mut wz = normal_matrix[6] * nxg
                            + normal_matrix[7] * nyg
                            + normal_matrix[8] * nzg;
                        let length = (wx * wx + wy * wy + wz * wz).sqrt();
                        gradient_magnitudes.push(length as f32);
                        if length > 1e-12 {
                            wx /= length;
                            wy /= length;
                            wz /= length;
                        } else {
                            wx = 0.0;
                            wy = 0.0;
                            wz = 1.0;
                        }
                        normals.push(wx as f32);
                        normals.push(wy as f32);
                        normals.push(wz as f32);

                        let index = (positions.len() / 3 - 1) as u32;
                        if on_current_layer {
                            current[slot] = index as i32;
                        } else {
                            next[slot] = index as i32;
                        }
                        index
                    };
                    edge_vertices[edge] = vertex_index;
                }

                let triangles = TRI_TABLE[cube_index];
                let mut t = 0;
                while t + 2 < triangles.len() && triangles[t] != -1 {
                    if indices.len() / 3 >= max_triangles as usize {
                        return Err(format!(
                            "Isosurface exceeded {max_triangles} triangles. Raise the threshold or increase the decimation step."
                        ));
                    }
                    indices.push(edge_vertices[triangles[t] as usize]);
                    indices.push(edge_vertices[triangles[t + 1] as usize]);
                    indices.push(edge_vertices[triangles[t + 2] as usize]);
                    t += 3;
                }
            }
        }

        // Advance a layer: the layer just finished is dead, and the one being
        // filled ahead becomes current.
        std::mem::swap(&mut current, &mut next);
        next.fill(-1);
    }

    let vertex_count = (positions.len() / 3) as u32;
    let triangle_count = (indices.len() / 3) as u32;
    Ok(IsosurfaceMesh {
        positions,
        normals,
        indices,
        gradient_magnitudes,
        vertex_count,
        triangle_count,
        step: vec![sx as u32, sy as u32, sz as u32],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A sphere of radius `radius` voxels, centred in an `n`-cubed volume,
    /// sampled as the signed distance from the centre. The isosurface at
    /// `radius` is then a sphere whose area and radius are known exactly.
    fn sphere(n: usize, radius: f64) -> (Vec<f32>, [u32; 3]) {
        let centre = (n - 1) as f64 / 2.0;
        let mut samples = vec![0f32; n * n * n];
        for k in 0..n {
            for j in 0..n {
                for i in 0..n {
                    let dx = i as f64 - centre;
                    let dy = j as f64 - centre;
                    let dz = k as f64 - centre;
                    // Inside is larger, matching the "denser tissue is
                    // brighter" convention the normals assume.
                    samples[i + j * n + k * n * n] =
                        (radius - (dx * dx + dy * dy + dz * dz).sqrt()) as f32;
                }
            }
        }
        (samples, [n as u32, n as u32, n as u32])
    }

    fn identity_affine() -> Vec<f64> {
        vec![
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ]
    }

    #[test]
    fn extracts_a_sphere_of_the_right_size() {
        let n = 32;
        let radius = 10.0;
        let (samples, sizes) = sphere(n, radius);
        let mesh = extract_isosurface_inner(
            &samples,
            &sizes,
            &identity_affine(),
            0.0, // the surface where distance == radius
            &[1, 1, 1],
            12_000_000,
        )
        .unwrap();

        assert!(mesh.vertex_count > 0 && mesh.triangle_count > 0);
        let centre = (n - 1) as f32 / 2.0;
        // Every vertex sits on the sphere, to within a voxel.
        for vertex in mesh.positions.chunks(3) {
            let d = ((vertex[0] - centre).powi(2)
                + (vertex[1] - centre).powi(2)
                + (vertex[2] - centre).powi(2))
            .sqrt();
            assert!(
                (d - radius as f32).abs() < 1.0,
                "vertex at distance {d} from the centre, expected {radius}"
            );
        }
    }

    /// Normals point outwards, away from the dense interior.
    #[test]
    fn normals_face_outwards() {
        let n = 24;
        let (samples, sizes) = sphere(n, 8.0);
        let mesh = extract_isosurface_inner(
            &samples,
            &sizes,
            &identity_affine(),
            0.0,
            &[1, 1, 1],
            1 << 24,
        )
        .unwrap();

        let centre = (n - 1) as f32 / 2.0;
        let mut checked = 0;
        for index in 0..mesh.vertex_count as usize {
            let p = &mesh.positions[index * 3..index * 3 + 3];
            let normal = &mesh.normals[index * 3..index * 3 + 3];
            let outward = [p[0] - centre, p[1] - centre, p[2] - centre];
            let length =
                (outward[0] * outward[0] + outward[1] * outward[1] + outward[2] * outward[2])
                    .sqrt();
            if length < 1e-3 {
                continue;
            }
            let dot =
                (outward[0] * normal[0] + outward[1] * normal[1] + outward[2] * normal[2]) / length;
            assert!(dot > 0.7, "normal points inwards: dot {dot}");
            checked += 1;
        }
        assert!(checked > 100, "only {checked} normals checked");
    }

    /// Every index addresses a real vertex, and the mesh is closed: a sphere
    /// has no boundary, so every edge is shared by exactly two triangles.
    #[test]
    fn the_mesh_is_indexed_and_closed() {
        let n = 20;
        let (samples, sizes) = sphere(n, 7.0);
        let mesh = extract_isosurface_inner(
            &samples,
            &sizes,
            &identity_affine(),
            0.0,
            &[1, 1, 1],
            1 << 24,
        )
        .unwrap();

        for &index in &mesh.indices {
            assert!(index < mesh.vertex_count, "index {index} past the vertices");
        }

        let mut edges: std::collections::HashMap<(u32, u32), i32> =
            std::collections::HashMap::new();
        for triangle in mesh.indices.chunks(3) {
            for pair in [
                (triangle[0], triangle[1]),
                (triangle[1], triangle[2]),
                (triangle[2], triangle[0]),
            ] {
                let key = (pair.0.min(pair.1), pair.0.max(pair.1));
                *edges.entry(key).or_insert(0) += 1;
            }
        }
        let open: Vec<_> = edges.iter().filter(|(_, count)| **count != 2).collect();
        assert!(
            open.is_empty(),
            "{} edges are not shared by two faces",
            open.len()
        );
    }

    /// The affine takes the mesh into world space, so a scaled volume produces
    /// a scaled surface rather than one in voxel indices.
    #[test]
    fn positions_come_out_in_world_space() {
        let n = 20;
        let (samples, sizes) = sphere(n, 6.0);
        let mut affine = identity_affine();
        affine[0] = 2.0; // 2 units per voxel in x
        affine[3] = 100.0; // origin offset
        let mesh =
            extract_isosurface_inner(&samples, &sizes, &affine, 0.0, &[1, 1, 1], 1 << 24).unwrap();

        let centre = (n - 1) as f32 / 2.0;
        let xs: Vec<f32> = mesh.positions.chunks(3).map(|p| p[0]).collect();
        let min = xs.iter().cloned().fold(f32::INFINITY, f32::min);
        let max = xs.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        // x spans 2 * 2 * radius around 100 + 2 * centre.
        assert!(
            (min - (100.0 + 2.0 * (centre - 6.0))).abs() < 1.0,
            "min x {min}"
        );
        assert!(
            (max - (100.0 + 2.0 * (centre + 6.0))).abs() < 1.0,
            "max x {max}"
        );
    }

    /// Decimation produces a coarser mesh of the same shape, and reports the
    /// step it used.
    #[test]
    fn decimation_coarsens_without_moving_the_surface() {
        let n = 32;
        let (samples, sizes) = sphere(n, 10.0);
        let fine = extract_isosurface_inner(
            &samples,
            &sizes,
            &identity_affine(),
            0.0,
            &[1, 1, 1],
            1 << 24,
        )
        .unwrap();
        let coarse = extract_isosurface_inner(
            &samples,
            &sizes,
            &identity_affine(),
            0.0,
            &[2, 2, 2],
            1 << 24,
        )
        .unwrap();

        assert_eq!(coarse.step, vec![2, 2, 2]);
        assert!(
            coarse.triangle_count < fine.triangle_count,
            "coarse {} vs fine {}",
            coarse.triangle_count,
            fine.triangle_count
        );
        let centre = (n - 1) as f32 / 2.0;
        for vertex in coarse.positions.chunks(3) {
            let d = ((vertex[0] - centre).powi(2)
                + (vertex[1] - centre).powi(2)
                + (vertex[2] - centre).powi(2))
            .sqrt();
            assert!((d - 10.0).abs() < 2.0, "decimated vertex at {d}");
        }
    }

    /// A volume entirely on one side of the threshold has no surface at all.
    #[test]
    fn a_uniform_volume_has_no_surface() {
        let samples = vec![5.0f32; 8 * 8 * 8];
        let mesh = extract_isosurface_inner(
            &samples,
            &[8, 8, 8],
            &identity_affine(),
            1.0,
            &[1, 1, 1],
            1 << 24,
        )
        .unwrap();
        assert_eq!(mesh.vertex_count, 0);
        assert_eq!(mesh.triangle_count, 0);
    }

    #[test]
    fn refuses_a_grid_too_small_to_march() {
        let samples = vec![0.0f32; 8];
        let error = extract_isosurface_inner(
            &samples,
            &[2, 2, 2],
            &identity_affine(),
            0.0,
            &[4, 4, 4],
            1 << 24,
        )
        .unwrap_err();
        assert!(error.contains("too small"), "{error}");
    }

    #[test]
    fn refuses_to_exceed_the_triangle_budget() {
        let n = 24;
        let (samples, sizes) = sphere(n, 8.0);
        let error =
            extract_isosurface_inner(&samples, &sizes, &identity_affine(), 0.0, &[1, 1, 1], 10)
                .unwrap_err();
        assert!(error.contains("exceeded"), "{error}");
    }
}
