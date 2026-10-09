//! Wavefront OBJ: vertices, polygons, polylines, points and material groups.
//!
//! Replaces a TypeScript parser that built one object per vertex, face, line
//! and point. Those objects then crossed the extension/webview boundary as
//! JSON, which took 20 s for a two-million-face model. The result here is flat
//! arrays that cross as raw buffers.
//!
//! What the viewer reads from an OBJ is reproduced exactly: the vertex list,
//! the raw `vn` list (the viewer assigns normal *i* to vertex *i*), polygons
//! fan-triangulated in file order, `l` polylines split into segments, `p`
//! points, and the material (`usemtl`) active for each of them. Texture
//! coordinates are only counted - nothing downstream uses them.
//!
//! One deliberate difference: negative (relative) indices, which the old
//! parser turned into out-of-range indices and so failed to load, resolve
//! against the vertices read so far, as the format specifies.

// Indices and counts are bounded by wasm32 memory (far below u32::MAX), and
// positions are f32 because the GPU buffers are.
#![allow(
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss
)]

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// A parsed OBJ. Buffers are moved out with the `take_*` methods.
#[wasm_bindgen]
pub struct ObjResult {
    positions: Vec<f32>,
    normals: Vec<f32>,
    texcoord_count: u32,
    /// Fan-triangulated polygons, in file order.
    indices: Vec<u32>,
    /// Corners per polygon; empty when every polygon is a triangle.
    face_sizes: Vec<u32>,
    /// Material id per polygon; empty when no polygon has a material.
    face_materials: Vec<u32>,
    face_count: u32,
    /// Two vertex indices per segment.
    line_indices: Vec<u32>,
    line_materials: Vec<u32>,
    point_indices: Vec<u32>,
    point_materials: Vec<u32>,
    /// Material names by id; id 0 is "no material".
    material_names: Vec<String>,
    material_file: String,
    current_material: String,
}

#[wasm_bindgen]
impl ObjResult {
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn vertex_count(&self) -> u32 {
        (self.positions.len() / 3) as u32
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn normal_count(&self) -> u32 {
        (self.normals.len() / 3) as u32
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn texcoord_count(&self) -> u32 {
        self.texcoord_count
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn face_count(&self) -> u32 {
        self.face_count
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn material_names(&self) -> Vec<String> {
        self.material_names.clone()
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn material_file(&self) -> String {
        self.material_file.clone()
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn current_material(&self) -> String {
        self.current_material.clone()
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
    pub fn take_face_sizes(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.face_sizes)
    }
    pub fn take_face_materials(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.face_materials)
    }
    pub fn take_line_indices(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.line_indices)
    }
    pub fn take_line_materials(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.line_materials)
    }
    pub fn take_point_indices(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.point_indices)
    }
    pub fn take_point_materials(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.point_materials)
    }
}

#[inline]
fn parse_f32(token: &[u8]) -> f32 {
    // `parseFloat` semantics: the numeric prefix, NaN when there is none.
    match fast_float::parse_partial::<f32, _>(token) {
        Ok((value, consumed)) if consumed > 0 => value,
        _ => f32::NAN,
    }
}

/// The vertex reference at the start of a corner token (`v`, `v/vt`,
/// `v//vn`, `v/vt/vn`), resolved to a 0-based index.
fn vertex_ref(token: &[u8], vertex_count: usize) -> Result<u32, String> {
    let end = token.iter().position(|&b| b == b'/').unwrap_or(token.len());
    let text = std::str::from_utf8(&token[..end]).unwrap_or("");
    let value: i64 = text
        .parse()
        .map_err(|_| format!("OBJ: invalid vertex reference \"{text}\""))?;
    let resolved = match value {
        v if v > 0 => v - 1,
        v if v < 0 => vertex_count as i64 + v,
        _ => -1,
    };
    if resolved < 0 || resolved as usize >= vertex_count {
        return Err(format!(
            "OBJ: vertex reference {value} is outside the {vertex_count} vertices defined before it"
        ));
    }
    Ok(resolved as u32)
}

#[derive(Default)]
struct ObjBuilder {
    result: ObjResult,
    material_ids: HashMap<Vec<u8>, u32>,
    current: u32,
    all_triangles: bool,
    any_material: bool,
    corners: Vec<u32>,
}

impl Default for ObjResult {
    fn default() -> Self {
        ObjResult {
            positions: Vec::new(),
            normals: Vec::new(),
            texcoord_count: 0,
            indices: Vec::new(),
            face_sizes: Vec::new(),
            face_materials: Vec::new(),
            face_count: 0,
            line_indices: Vec::new(),
            line_materials: Vec::new(),
            point_indices: Vec::new(),
            point_materials: Vec::new(),
            material_names: vec![String::new()],
            material_file: String::new(),
            current_material: String::new(),
        }
    }
}

impl ObjBuilder {
    fn vertex_count(&self) -> usize {
        self.result.positions.len() / 3
    }

    fn use_material(&mut self, name: &[u8]) {
        let next = self.result.material_names.len() as u32;
        let id = *self.material_ids.entry(name.to_vec()).or_insert(next);
        if id == next {
            self.result
                .material_names
                .push(String::from_utf8_lossy(name).into_owned());
        }
        self.current = id;
        self.any_material = true;
        self.result.current_material = String::from_utf8_lossy(name).into_owned();
    }

    fn face<'a>(&mut self, corners: impl Iterator<Item = &'a [u8]>) -> Result<(), String> {
        let vertex_count = self.vertex_count();
        self.corners.clear();
        for token in corners {
            self.corners.push(vertex_ref(token, vertex_count)?);
        }
        let size = self.corners.len();
        if size < 3 {
            return Ok(());
        }
        let first = self.corners[0];
        for k in 1..size - 1 {
            self.result
                .indices
                .extend([first, self.corners[k], self.corners[k + 1]]);
        }
        let face = self.result.face_count as usize;
        if size != 3 && self.all_triangles {
            // First non-triangle: every earlier polygon had three corners.
            self.all_triangles = false;
            self.result.face_sizes = vec![3; face];
        }
        if !self.all_triangles {
            self.result.face_sizes.push(size as u32);
        }
        self.result.face_materials.push(self.current);
        self.result.face_count += 1;
        Ok(())
    }

    fn line<'a>(&mut self, refs: impl Iterator<Item = &'a [u8]>) -> Result<(), String> {
        let vertex_count = self.vertex_count();
        self.corners.clear();
        for token in refs {
            self.corners.push(vertex_ref(token, vertex_count)?);
        }
        for pair in self.corners.windows(2) {
            self.result.line_indices.extend([pair[0], pair[1]]);
            self.result.line_materials.push(self.current);
        }
        Ok(())
    }

    fn points<'a>(&mut self, refs: impl Iterator<Item = &'a [u8]>) -> Result<(), String> {
        let vertex_count = self.vertex_count();
        for token in refs {
            self.result
                .point_indices
                .push(vertex_ref(token, vertex_count)?);
            self.result.point_materials.push(self.current);
        }
        Ok(())
    }

    fn line_of(&mut self, line: &[u8]) -> Result<(), String> {
        let mut tokens = line
            .split(u8::is_ascii_whitespace)
            .filter(|token| !token.is_empty());
        let Some(command) = tokens.next() else {
            return Ok(());
        };
        match command {
            b"v" => {
                let (Some(x), Some(y), Some(z)) = (tokens.next(), tokens.next(), tokens.next())
                else {
                    return Ok(());
                };
                self.result
                    .positions
                    .extend([parse_f32(x), parse_f32(y), parse_f32(z)]);
            }
            b"vn" => {
                let (Some(x), Some(y), Some(z)) = (tokens.next(), tokens.next(), tokens.next())
                else {
                    return Ok(());
                };
                self.result
                    .normals
                    .extend([parse_f32(x), parse_f32(y), parse_f32(z)]);
            }
            b"vt" => {
                if tokens.next().is_some() {
                    self.result.texcoord_count += 1;
                }
            }
            b"f" => self.face(tokens)?,
            b"l" => self.line(tokens)?,
            b"p" => self.points(tokens)?,
            b"usemtl" => {
                if let Some(name) = tokens.next() {
                    self.use_material(name);
                }
            }
            b"mtllib" => {
                // The rest of the line: library names may contain spaces.
                let rest = line[command.len()..].trim_ascii();
                if !rest.is_empty() {
                    self.result.material_file = String::from_utf8_lossy(rest).into_owned();
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn finish(mut self) -> ObjResult {
        if !self.any_material {
            self.result.face_materials.clear();
            self.result.line_materials.clear();
            self.result.point_materials.clear();
        }
        self.result
    }
}

/// Parse a Wavefront OBJ.
///
/// # Errors
/// Fails when a face, line or point refers to a vertex that does not exist.
#[wasm_bindgen]
pub fn parse_obj(data: &[u8]) -> Result<ObjResult, JsValue> {
    parse_obj_native(data).map_err(|message| JsValue::from_str(&message))
}

/// [`parse_obj`] for native callers and tests.
///
/// # Errors
/// See [`parse_obj`].
pub fn parse_obj_native(data: &[u8]) -> Result<ObjResult, String> {
    let mut builder = ObjBuilder {
        all_triangles: true,
        ..ObjBuilder::default()
    };
    // Typical exports run ~30 bytes per vertex row and as many per face row.
    let estimate = data.len() / 64;
    builder.result.positions.reserve(estimate * 3);
    builder.result.indices.reserve(estimate * 3);
    for line in data.split(|&b| b == b'\n') {
        let line = line.trim_ascii();
        if line.is_empty() || line[0] == b'#' {
            continue;
        }
        builder.line_of(line)?;
    }
    Ok(builder.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn triangles_keep_one_index_per_corner_and_no_face_sizes() {
        let mut obj = parse_obj_native(b"v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n").unwrap();
        assert_eq!(obj.vertex_count(), 3);
        assert_eq!(obj.face_count(), 1);
        assert_eq!(obj.take_indices(), vec![0, 1, 2]);
        assert!(obj.take_face_sizes().is_empty());
        assert!(obj.take_face_materials().is_empty());
    }

    #[test]
    fn polygons_fan_triangulate_and_record_their_sizes() {
        let text = b"v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3\nf 1/1/1 2/2/2 3/3/3 4/4/4\n";
        let mut obj = parse_obj_native(text).unwrap();
        assert_eq!(obj.take_indices(), vec![0, 1, 2, 0, 1, 2, 0, 2, 3]);
        assert_eq!(obj.take_face_sizes(), vec![3, 4]);
    }

    #[test]
    fn materials_are_tracked_per_face_line_and_point() {
        let text = b"mtllib my materials.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nusemtl red\nf 1 2 3\nusemtl blue\nl 1 2 3\np 1\nusemtl red\nf 3 2 1\n";
        let mut obj = parse_obj_native(text).unwrap();
        assert_eq!(obj.material_file(), "my materials.mtl");
        assert_eq!(obj.current_material(), "red");
        assert_eq!(obj.material_names(), vec!["", "red", "blue"]);
        assert_eq!(obj.take_face_materials(), vec![1, 1]);
        assert_eq!(obj.take_line_indices(), vec![0, 1, 1, 2]);
        assert_eq!(obj.take_line_materials(), vec![2, 2]);
        assert_eq!(obj.take_point_materials(), vec![2]);
    }

    #[test]
    fn negative_references_count_back_from_the_last_vertex() {
        let mut obj = parse_obj_native(b"v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n").unwrap();
        assert_eq!(obj.take_indices(), vec![0, 1, 2]);
    }

    #[test]
    fn references_past_the_vertex_list_are_rejected() {
        let error = parse_obj_native(b"v 0 0 0\nf 1 2 3\n").err().unwrap();
        assert!(error.contains("vertex reference 2"), "{error}");
    }

    #[test]
    fn normals_and_texture_coordinates_are_read() {
        let mut obj =
            parse_obj_native(b"# comment\nv 0 0 0\nvn 0 0 1\nvt 0.5 0.5\nvt 1\n").unwrap();
        assert_eq!(obj.take_normals(), vec![0.0, 0.0, 1.0]);
        assert_eq!(obj.texcoord_count(), 2);
    }
}
