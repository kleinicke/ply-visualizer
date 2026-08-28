//! Voxel-shell meshing: the "voxels" render mode.
//!
//! Every retained voxel becomes a box, but only the faces that are actually
//! exposed are emitted — a face whose neighbour is also retained is inside the
//! block and never seen. That is what keeps a solid organ from producing a
//! quad per voxel per side.
//!
//! Ported from `engine/src/visualization/volumeVoxels.ts`. As with marching
//! cubes, the cooperative yielding went with it: the TypeScript awaited a
//! `setTimeout(0)` per k-slab so the page could paint, which on a 256-deep
//! volume is 256 clamped timer round-trips of pure waiting.

use wasm_bindgen::prelude::*;

/// Corner sign patterns per face: axis, direction, then four (u,v) sign pairs.
/// Generated from the TypeScript table so the winding cannot drift.
const FACES: [(usize, i32, [(i32, i32); 4]); 6] = [
    (0, 1, [(-1, -1), (1, -1), (1, 1), (-1, 1)]),
    (0, -1, [(-1, -1), (-1, 1), (1, 1), (1, -1)]),
    (1, 1, [(-1, -1), (-1, 1), (1, 1), (1, -1)]),
    (1, -1, [(-1, -1), (1, -1), (1, 1), (-1, 1)]),
    (2, 1, [(-1, -1), (1, -1), (1, 1), (-1, 1)]),
    (2, -1, [(-1, -1), (-1, 1), (1, 1), (1, -1)]),
];

/// Symmetric per-axis tint baked into the vertex colours. The scene's single
/// directional light would leave whole sides of the block near-black, which is
/// unusable for greyscale medical data, so voxels render unlit like the slice
/// mode and get this fixed shading instead. Opposite faces share a factor, so
/// the mapping from sample value to displayed grey stays the same whichever way
/// the camera looks at a face.
const AXIS_SHADE: [f64; 3] = [0.78, 0.89, 1.0];

/// How a voxel value becomes a displayed grey. Mirrors
/// `visualization/volumePresentation.ts`, which stays in TypeScript because
/// choosing the mode is UI state; only the arithmetic is here.
struct Brightness<'a> {
    mode: &'a str,
    window_center: f64,
    window_width: f64,
    slice_ranges: &'a [f64],
    volume_range: &'a [f64],
    monochrome1: bool,
}

impl Brightness<'_> {
    fn grey(&self, value: f64, k: usize) -> f64 {
        let windowed = |center: f64, width: f64| {
            let width = width.max(f64::EPSILON);
            let low = center - width / 2.0;
            ((value - low) / width).clamp(0.0, 1.0)
        };
        let mapped = match self.mode {
            "slice-auto" | "volume-auto" => {
                let range = if self.mode == "slice-auto" {
                    self.slice_ranges.get(k * 2..k * 2 + 2)
                } else {
                    self.volume_range.get(0..2)
                };
                match range {
                    Some([min, max]) if min.is_finite() && max.is_finite() => {
                        let width = max - min;
                        if width > 0.0 {
                            ((value - min) / width).clamp(0.0, 1.0)
                        } else {
                            // The 2D viewer renders a constant-valued image as
                            // black after auto normalization, MONOCHROME1
                            // included — so this returns before the inversion.
                            return 0.0;
                        }
                    }
                    _ => windowed(self.window_center, self.window_width),
                }
            }
            _ => windowed(self.window_center, self.window_width),
        };
        let mapped = if self.monochrome1 {
            1.0 - mapped
        } else {
            mapped
        };
        (mapped * 255.0).round()
    }
}

/// A voxel-shell mesh, ready for a `BufferGeometry`.
#[wasm_bindgen]
#[cfg_attr(test, derive(Debug))]
pub struct VoxelMesh {
    positions: Vec<f32>,
    colors: Vec<u8>,
    intensity: Vec<f32>,
    indices: Vec<u32>,
    vertex_count: u32,
    face_count: u32,
    voxel_count: u32,
    step: Vec<u32>,
    voxel_size: Vec<f32>,
}

#[wasm_bindgen]
impl VoxelMesh {
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }
    #[wasm_bindgen(getter)]
    pub fn face_count(&self) -> u32 {
        self.face_count
    }
    /// Voxels at or above the threshold, whether or not they showed a face.
    /// Reported to the user as what the render mode actually kept.
    #[wasm_bindgen(getter)]
    pub fn voxel_count(&self) -> u32 {
        self.voxel_count
    }
    /// The decimation actually used: the stride grows until the build fits the
    /// face budget, and callers report what they rendered.
    #[wasm_bindgen(getter)]
    pub fn step(&self) -> Vec<u32> {
        self.step.clone()
    }
    /// World-space edge lengths of one emitted box, along i/j/k.
    #[wasm_bindgen(getter)]
    pub fn voxel_size(&self) -> Vec<f32> {
        self.voxel_size.clone()
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.positions)
    }
    pub fn take_colors(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.colors)
    }
    pub fn take_intensity(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.intensity)
    }
    pub fn take_indices(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.indices)
    }
}

struct Grid<'a> {
    samples: &'a [f32],
    sizes: [usize; 3],
    clip: [[usize; 2]; 3],
    threshold: f64,
}

impl Grid<'_> {
    fn value(&self, i: usize, j: usize, k: usize) -> f64 {
        self.samples[i + j * self.sizes[0] + k * self.sizes[0] * self.sizes[1]] as f64
    }

    /// A neighbour hides a face only when it is retained *and* itself visible:
    /// a voxel outside the clip is not there, so the face beside it is exposed.
    fn is_solid(&self, ijk: [i64; 3]) -> bool {
        for axis in 0..3 {
            if ijk[axis] < 0 || ijk[axis] >= self.sizes[axis] as i64 {
                return false;
            }
            if (ijk[axis] as usize) < self.clip[axis][0]
                || (ijk[axis] as usize) > self.clip[axis][1]
            {
                return false;
            }
        }
        self.value(ijk[0] as usize, ijk[1] as usize, ijk[2] as usize) >= self.threshold
    }
}

/// First sample index on the global stride grid that the clip range keeps.
fn clip_start(clip: [usize; 2], stride: usize) -> usize {
    clip[0].div_ceil(stride) * stride
}

fn count_faces(grid: &Grid, step: [usize; 3], limit: usize) -> usize {
    let mut faces = 0usize;
    let mut k = clip_start(grid.clip[2], step[2]);
    while k <= grid.clip[2][1] && k < grid.sizes[2] {
        let mut j = clip_start(grid.clip[1], step[1]);
        while j <= grid.clip[1][1] && j < grid.sizes[1] {
            let mut i = clip_start(grid.clip[0], step[0]);
            while i <= grid.clip[0][1] && i < grid.sizes[0] {
                if grid.value(i, j, k) >= grid.threshold {
                    for (axis, dir, _) in FACES {
                        let mut neighbour = [i as i64, j as i64, k as i64];
                        neighbour[axis] += dir as i64 * step[axis] as i64;
                        if !grid.is_solid(neighbour) {
                            faces += 1;
                            if faces >= limit {
                                return faces;
                            }
                        }
                    }
                }
                i += step[0];
            }
            j += step[1];
        }
        k += step[2];
    }
    faces
}

/// Build the exposed shell of every retained voxel.
///
/// `clip` is six inclusive bounds (i0,i1,j0,j1,k0,k1); the stride grows from
/// `step` until the face count fits `max_faces`, because a low threshold on a
/// large volume would otherwise allocate hundreds of megabytes of geometry.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn build_volume_voxels(
    samples: &[f32],
    sizes: &[u32],
    ijk_to_world: &[f64],
    threshold: f64,
    step: &[u32],
    max_faces: u32,
    clip: &[u32],
    brightness_mode: &str,
    window_center: f64,
    window_width: f64,
    slice_ranges: &[f64],
    volume_range: &[f64],
    monochrome1: bool,
) -> Result<VoxelMesh, JsValue> {
    if sizes.len() < 3 || ijk_to_world.len() < 12 || step.len() < 3 || clip.len() < 6 {
        return Err(JsValue::from_str(
            "voxel build needs 3 sizes, 3 steps, a 4x4 affine and 6 clip bounds",
        ));
    }
    let volume_sizes = [sizes[0] as usize, sizes[1] as usize, sizes[2] as usize];
    if samples.len() < volume_sizes[0] * volume_sizes[1] * volume_sizes[2] {
        return Err(JsValue::from_str("volume has fewer samples than its sizes"));
    }
    let grid = Grid {
        samples,
        sizes: volume_sizes,
        clip: [
            [clip[0] as usize, clip[1] as usize],
            [clip[2] as usize, clip[3] as usize],
            [clip[4] as usize, clip[5] as usize],
        ],
        threshold,
    };
    let base = [
        (step[0] as usize).max(1),
        (step[1] as usize).max(1),
        (step[2] as usize).max(1),
    ];
    let budget = (max_faces as usize).max(1);

    // Count first, then grow the stride until it fits. The boxes stay gap-free
    // because their extent scales with the stride.
    let mut multiplier = 1usize;
    let mut used_step;
    let mut faces;
    loop {
        used_step = [
            (base[0] * multiplier).max(1),
            (base[1] * multiplier).max(1),
            (base[2] * multiplier).max(1),
        ];
        faces = count_faces(&grid, used_step, budget + 1);
        if faces <= budget {
            break;
        }
        multiplier += 1;
    }

    let m = ijk_to_world;
    let [sx, sy, sz] = used_step;
    // Half-extent vectors of one box, computed once and reused for every voxel.
    let half = [
        [
            m[0] * sx as f64 / 2.0,
            m[4] * sx as f64 / 2.0,
            m[8] * sx as f64 / 2.0,
        ],
        [
            m[1] * sy as f64 / 2.0,
            m[5] * sy as f64 / 2.0,
            m[9] * sy as f64 / 2.0,
        ],
        [
            m[2] * sz as f64 / 2.0,
            m[6] * sz as f64 / 2.0,
            m[10] * sz as f64 / 2.0,
        ],
    ];
    // The sampled voxel represents the cell [i, i+step), so the box centre sits
    // half a stride past the sample it was taken from.
    let centre_shift = [
        (sx as f64 - 1.0) / 2.0,
        (sy as f64 - 1.0) / 2.0,
        (sz as f64 - 1.0) / 2.0,
    ];
    let brightness = Brightness {
        mode: brightness_mode,
        window_center,
        window_width,
        slice_ranges,
        volume_range,
        monochrome1,
    };

    let mut positions = vec![0f32; faces * 4 * 3];
    let mut colors = vec![0u8; faces * 4 * 3];
    let mut intensity = vec![0f32; faces * 4];
    let mut indices = vec![0u32; faces * 6];
    let mut vertex = 0usize;
    let mut index = 0usize;
    let mut voxels = 0usize;

    let mut k = clip_start(grid.clip[2], sz);
    while k <= grid.clip[2][1] && k < volume_sizes[2] {
        let mut j = clip_start(grid.clip[1], sy);
        while j <= grid.clip[1][1] && j < volume_sizes[1] {
            let mut i = clip_start(grid.clip[0], sx);
            while i <= grid.clip[0][1] && i < volume_sizes[0] {
                let value = grid.value(i, j, k);
                if value < threshold {
                    i += sx;
                    continue;
                }
                voxels += 1;
                let ci = i as f64 + centre_shift[0];
                let cj = j as f64 + centre_shift[1];
                let ck = k as f64 + centre_shift[2];
                let cx = m[0] * ci + m[1] * cj + m[2] * ck + m[3];
                let cy = m[4] * ci + m[5] * cj + m[6] * ck + m[7];
                let cz = m[8] * ci + m[9] * cj + m[10] * ck + m[11];
                let grey = brightness.grey(value, k);

                for (axis, dir, corners) in FACES {
                    let mut neighbour = [i as i64, j as i64, k as i64];
                    neighbour[axis] += dir as i64 * used_step[axis] as i64;
                    if grid.is_solid(neighbour) {
                        continue;
                    }
                    let (u_axis, v_axis) = match axis {
                        0 => (1, 2),
                        1 => (0, 2),
                        _ => (0, 1),
                    };
                    let normal_half = half[axis];
                    let u_half = half[u_axis];
                    let v_half = half[v_axis];
                    let shaded = (grey * AXIS_SHADE[axis]).round().clamp(0.0, 255.0) as u8;
                    let first = vertex as u32;

                    for (us, vs) in corners {
                        let p = vertex * 3;
                        let (us, vs) = (us as f64, vs as f64);
                        positions[p] =
                            (cx + dir as f64 * normal_half[0] + us * u_half[0] + vs * v_half[0])
                                as f32;
                        positions[p + 1] =
                            (cy + dir as f64 * normal_half[1] + us * u_half[1] + vs * v_half[1])
                                as f32;
                        positions[p + 2] =
                            (cz + dir as f64 * normal_half[2] + us * u_half[2] + vs * v_half[2])
                                as f32;
                        colors[p] = shaded;
                        colors[p + 1] = shaded;
                        colors[p + 2] = shaded;
                        intensity[vertex] = value as f32;
                        vertex += 1;
                    }
                    indices[index] = first;
                    indices[index + 1] = first + 1;
                    indices[index + 2] = first + 2;
                    indices[index + 3] = first;
                    indices[index + 4] = first + 2;
                    indices[index + 5] = first + 3;
                    index += 6;
                }
                i += sx;
            }
            j += sy;
        }
        k += sz;
    }

    let voxel_size = vec![
        ((m[0] * m[0] + m[4] * m[4] + m[8] * m[8]).sqrt() * sx as f64) as f32,
        ((m[1] * m[1] + m[5] * m[5] + m[9] * m[9]).sqrt() * sy as f64) as f32,
        ((m[2] * m[2] + m[6] * m[6] + m[10] * m[10]).sqrt() * sz as f64) as f32,
    ];

    Ok(VoxelMesh {
        vertex_count: vertex as u32,
        face_count: (index / 6) as u32,
        voxel_count: voxels as u32,
        positions,
        colors,
        intensity,
        indices,
        step: used_step.iter().map(|value| *value as u32).collect(),
        voxel_size,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity() -> Vec<f64> {
        vec![
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ]
    }

    fn build(samples: &[f32], sizes: [u32; 3], threshold: f64, step: [u32; 3]) -> VoxelMesh {
        let clip = [0, sizes[0] - 1, 0, sizes[1] - 1, 0, sizes[2] - 1];
        build_volume_voxels(
            samples,
            &sizes,
            &identity(),
            threshold,
            &step,
            1_000_000,
            &clip,
            "dicom-window",
            0.5,
            1.0,
            &[],
            &[],
            false,
        )
        .unwrap()
    }

    /// One retained voxel is a closed box: six faces, twelve triangles, and
    /// four corners each.
    #[test]
    fn a_single_voxel_is_a_whole_box() {
        let mut samples = vec![0f32; 27];
        samples[13] = 1.0; // the middle of a 3x3x3
        let mesh = build(&samples, [3, 3, 3], 0.5, [1, 1, 1]);
        assert_eq!(mesh.face_count, 6);
        assert_eq!(mesh.vertex_count, 24);
        assert_eq!(mesh.indices.len(), 36);
    }

    /// Two neighbours hide the faces between them: the shared pair is not
    /// emitted, which is the whole point of meshing the shell.
    #[test]
    fn touching_voxels_hide_the_face_between_them() {
        let mut samples = vec![0f32; 27];
        samples[13] = 1.0;
        samples[14] = 1.0; // +i neighbour
        let mesh = build(&samples, [3, 3, 3], 0.5, [1, 1, 1]);
        assert_eq!(mesh.face_count, 10, "twelve faces minus the shared pair");
    }

    #[test]
    fn an_empty_volume_produces_nothing() {
        let mesh = build(&vec![0f32; 27], [3, 3, 3], 0.5, [1, 1, 1]);
        assert_eq!(mesh.face_count, 0);
        assert_eq!(mesh.vertex_count, 0);
    }

    /// Every index addresses a real vertex, and each face is two triangles over
    /// its own four corners.
    #[test]
    fn the_mesh_is_indexed_consistently() {
        let mut samples = vec![0f32; 125];
        for (index, value) in samples.iter_mut().enumerate() {
            if index % 3 == 0 {
                *value = 1.0;
            }
        }
        let mesh = build(&samples, [5, 5, 5], 0.5, [1, 1, 1]);
        assert!(mesh.face_count > 0);
        for &index in &mesh.indices {
            assert!(index < mesh.vertex_count, "index {index} past the vertices");
        }
        for face in 0..mesh.face_count as usize {
            let base = (face * 4) as u32;
            let expected = [base, base + 1, base + 2, base, base + 2, base + 3];
            assert_eq!(&mesh.indices[face * 6..face * 6 + 6], &expected);
        }
    }

    /// The box sits on the sample it came from, and its faces are half a voxel
    /// out along each axis.
    #[test]
    fn a_box_is_centred_on_its_sample() {
        let mut samples = vec![0f32; 27];
        samples[13] = 1.0;
        let mesh = build(&samples, [3, 3, 3], 0.5, [1, 1, 1]);
        let xs: Vec<f32> = mesh.positions.chunks(3).map(|p| p[0]).collect();
        let min = xs.iter().cloned().fold(f32::INFINITY, f32::min);
        let max = xs.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        assert!((min - 0.5).abs() < 1e-6, "min x {min}");
        assert!((max - 1.5).abs() < 1e-6, "max x {max}");
    }

    /// The stride grows until the build fits its budget rather than allocating
    /// hundreds of megabytes of geometry.
    #[test]
    fn the_stride_grows_to_fit_the_face_budget() {
        let samples = vec![1f32; 16 * 16 * 16];
        let clip = [0, 15, 0, 15, 0, 15];
        let mesh = build_volume_voxels(
            &samples,
            &[16, 16, 16],
            &identity(),
            0.5,
            &[1, 1, 1],
            200, // far below what step 1 would emit
            &clip,
            "dicom-window",
            0.5,
            1.0,
            &[],
            &[],
            false,
        )
        .unwrap();
        assert!(mesh.step[0] > 1, "step stayed at {:?}", mesh.step);
        assert!(mesh.face_count <= 200, "{} faces emitted", mesh.face_count);
    }

    /// Clipping rebuilds the shell rather than hiding faces: the cut face has
    /// to exist, or the block looks hollow.
    #[test]
    fn a_clip_caps_the_cut_with_real_faces() {
        let samples = vec![1f32; 4 * 4 * 4];
        let whole = build(&samples, [4, 4, 4], 0.5, [1, 1, 1]);
        let half = build_volume_voxels(
            &samples,
            &[4, 4, 4],
            &identity(),
            0.5,
            &[1, 1, 1],
            1_000_000,
            &[0, 1, 0, 3, 0, 3], // keep i in 0..=1
            "dicom-window",
            0.5,
            1.0,
            &[],
            &[],
            false,
        )
        .unwrap();
        // A 4x4x4 solid shows 6*16 = 96 faces; half of it shows 2*16 on the
        // two i faces plus 4*8 around the sides.
        assert_eq!(whole.face_count, 96);
        assert_eq!(half.face_count, 64);
    }

    #[test]
    fn monochrome1_inverts_the_grey() {
        let mut samples = vec![0f32; 27];
        samples[13] = 1.0;
        let bright = build(&samples, [3, 3, 3], 0.5, [1, 1, 1]);
        let inverted = build_volume_voxels(
            &samples,
            &[3, 3, 3],
            &identity(),
            0.5,
            &[1, 1, 1],
            1_000_000,
            &[0, 2, 0, 2, 0, 2],
            "dicom-window",
            0.5,
            1.0,
            &[],
            &[],
            true,
        )
        .unwrap();
        assert!(bright.colors[0] > inverted.colors[0], "MONOCHROME1 inverts");
    }
}
