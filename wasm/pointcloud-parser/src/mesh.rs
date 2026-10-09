//! Triangle-mesh formats: STL (binary and ASCII) and OFF.
//!
//! These used to be parsed in TypeScript into one object per triangle or
//! vertex, which the extension then posted to the webview. VS Code serialises
//! everything in a webview message that is not an `ArrayBuffer` as JSON, so a
//! two-million-triangle STL did not load at all: the JSON passed V8's string
//! limit. Here the result is packed typed arrays from the start - positions,
//! optional normals and colours, and a triangle index buffer - which cross the
//! message boundary as raw buffers and go straight into a `BufferGeometry`.
//!
//! The output deliberately reproduces what the viewer built from the old
//! object form, vertex for vertex, so the change is invisible on screen:
//!
//! * STL vertices are welded by exact coordinate, in first-seen order. A
//!   welded vertex keeps the facet normal and colour of the triangle that
//!   introduced it. Uncoloured vertices are grey 180.
//! * OFF polygons are fan-triangulated, and malformed files are rejected with
//!   the messages the TypeScript parser used.

// Numeric narrowing here is the format's own: the viewer's GPU buffers are
// f32 positions and u32 indices, colours are clamped to 0..=255 before the
// cast, and counts are bounded by wasm32 memory, far below u32::MAX.
#![allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};
use wasm_bindgen::prelude::*;

/// A parsed triangle mesh. Buffers are moved out with the `take_*` methods.
#[wasm_bindgen]
pub struct MeshResult {
    positions: Vec<f32>,
    normals: Vec<f32>,
    colors: Vec<u8>,
    indices: Vec<u32>,
    has_normals: bool,
    has_colors: bool,
    /// Format facts the buffers cannot carry, as JSON.
    metadata: String,
}

#[wasm_bindgen]
impl MeshResult {
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn vertex_count(&self) -> u32 {
        (self.positions.len() / 3) as u32
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn triangle_count(&self) -> u32 {
        (self.indices.len() / 3) as u32
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn has_normals(&self) -> bool {
        self.has_normals
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn has_colors(&self) -> bool {
        self.has_colors
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn metadata_json(&self) -> String {
        self.metadata.clone()
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.positions)
    }
    pub fn take_normals(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.normals)
    }
    pub fn take_colors(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.colors)
    }
    pub fn take_indices(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.indices)
    }
}

/// `FxHash`: the welding map hashes millions of coordinate triples, where the
/// default `SipHash` is the dominant cost and its `DoS` resistance buys nothing.
#[derive(Default)]
struct FxHasher(u64);

impl Hasher for FxHasher {
    #[inline]
    fn write(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.write_u64(u64::from(b));
        }
    }
    #[inline]
    fn write_u64(&mut self, value: u64) {
        self.0 = (self.0.rotate_left(5) ^ value).wrapping_mul(0x51_7c_c1_b7_27_22_0a_95);
    }
    #[inline]
    fn finish(&self) -> u64 {
        self.0
    }
}

type FxMap<K, V> = HashMap<K, V, BuildHasherDefault<FxHasher>>;

/// The welding key of one coordinate, matching the JavaScript string key it
/// replaces (`${x},${y},${z}`): `-0` prints as `0` and every NaN as `NaN`, so
/// those collapse to one key each; every other distinct value stays distinct.
#[inline]
fn weld_bits(value: f64) -> u64 {
    if value == 0.0 {
        0
    } else if value.is_nan() {
        f64::NAN.to_bits()
    } else {
        value.to_bits()
    }
}

/// [`weld_bits`] for a binary STL's f32 coordinates. Distinct f32 values stay
/// distinct as doubles, so keying on the f32 bits welds exactly the same
/// corners with half the key size.
#[inline]
fn weld_bits32(value: f32) -> u32 {
    if value == 0.0 {
        0
    } else if value.is_nan() {
        f32::NAN.to_bits()
    } else {
        value.to_bits()
    }
}

/// A corner key, hashed in whole words. The derived `Hash` of an array writes
/// a length prefix and every element separately, which is most of the cost of
/// a weld lookup.
#[derive(Clone, Copy, PartialEq, Eq)]
struct Key32([u32; 3]);

impl std::hash::Hash for Key32 {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.write_u64(u64::from(self.0[0]) | (u64::from(self.0[1]) << 32));
        state.write_u64(u64::from(self.0[2]));
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct Key64([u64; 3]);

impl std::hash::Hash for Key64 {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.write_u64(self.0[0]);
        state.write_u64(self.0[1]);
        state.write_u64(self.0[2]);
    }
}

const STL_GREY: u8 = 180;

/// Accumulates welded STL triangles.
struct StlWelder<K> {
    map: FxMap<K, u32>,
    positions: Vec<f32>,
    normals: Vec<f32>,
    colors: Vec<u8>,
    indices: Vec<u32>,
}

impl<K: std::hash::Hash + Eq> StlWelder<K> {
    fn with_triangles(triangles: usize) -> Self {
        // A closed surface welds to roughly half as many vertices as
        // triangles; the buffers grow if that guess is low.
        let vertices = triangles / 2 + 16;
        let mut map = FxMap::default();
        map.reserve(vertices);
        StlWelder {
            map,
            positions: Vec::with_capacity(vertices * 3),
            normals: Vec::with_capacity(vertices * 3),
            colors: Vec::with_capacity(vertices * 3),
            indices: Vec::with_capacity(triangles * 3),
        }
    }

    #[inline]
    fn push_corner(&mut self, key: K, xyz: [f32; 3], normal: [f32; 3], color: [u8; 3]) {
        let next = (self.positions.len() / 3) as u32;
        let index = *self.map.entry(key).or_insert(next);
        if index == next {
            self.positions.extend(xyz);
            self.normals.extend(normal);
            self.colors.extend(color);
        }
        self.indices.push(index);
    }

    fn finish(self, metadata: String) -> MeshResult {
        MeshResult {
            positions: self.positions,
            normals: self.normals,
            colors: self.colors,
            indices: self.indices,
            has_normals: true,
            has_colors: true,
            metadata,
        }
    }
}

fn json_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

fn stl_metadata(format: &str, header: &str, triangles: usize, has_colors: bool) -> String {
    format!(
        "{{\"format\":\"{format}\",\"header\":{},\"triangleCount\":{triangles},\"sourceHasColors\":{has_colors}}}",
        json_string(header)
    )
}

/// The size test the TypeScript parser used to tell a binary STL from an ASCII
/// one that happens to start with `solid`: the declared triangle count must
/// account for the file length, within a tolerance.
fn is_binary_stl(data: &[u8]) -> bool {
    if data.len() < 84 {
        return false;
    }
    let count = u32::from_le_bytes([data[80], data[81], data[82], data[83]]) as usize;
    if count > 100_000_000 {
        return false;
    }
    let expected = 84 + count * 50;
    let tolerance = 100usize.max(count / 10);
    data.len().abs_diff(expected) <= tolerance
}

fn looks_like_ascii_stl(data: &[u8]) -> bool {
    let head = String::from_utf8_lossy(&data[..data.len().min(1024)]).to_lowercase();
    head.contains("solid ") && head.contains("facet normal") && !is_binary_stl(data)
}

/// Parse an STL file, binary or ASCII.
#[wasm_bindgen]
#[must_use]
pub fn parse_stl(data: &[u8]) -> MeshResult {
    if looks_like_ascii_stl(data) {
        parse_ascii_stl(data)
    } else {
        parse_binary_stl(data)
    }
}

fn parse_binary_stl(data: &[u8]) -> MeshResult {
    let header = if data.len() >= 80 {
        String::from_utf8_lossy(&data[..80])
            .replace('\0', "")
            .trim()
            .to_string()
    } else {
        String::new()
    };
    let declared = if data.len() >= 84 {
        u32::from_le_bytes([data[80], data[81], data[82], data[83]]) as usize
    } else {
        0
    };
    // A truncated file keeps the triangles it actually holds.
    let available = data.len().saturating_sub(84) / 50;
    let count = declared.min(available);
    let mut welder = StlWelder::<Key32>::with_triangles(count);
    let mut has_colors = false;
    let f32_at =
        |at: usize| f32::from_le_bytes([data[at], data[at + 1], data[at + 2], data[at + 3]]);
    for t in 0..count {
        let at = 84 + t * 50;
        let normal = [f32_at(at), f32_at(at + 4), f32_at(at + 8)];
        // Some writers store RGB565 in the attribute word. A value of 0 or 1
        // carries no colour (the old parser required the "byte count" >= 2).
        let attribute = u16::from_le_bytes([data[at + 48], data[at + 49]]);
        let color = if attribute >= 2 {
            has_colors = true;
            [
                (((attribute >> 11) & 0x1f) * 8) as u8,
                (((attribute >> 5) & 0x3f) * 4) as u8,
                ((attribute & 0x1f) * 8) as u8,
            ]
        } else {
            [STL_GREY; 3]
        };
        for corner in 0..3 {
            let base = at + 12 + corner * 12;
            let xyz = [f32_at(base), f32_at(base + 4), f32_at(base + 8)];
            let key = Key32([
                weld_bits32(xyz[0]),
                weld_bits32(xyz[1]),
                weld_bits32(xyz[2]),
            ]);
            welder.push_corner(key, xyz, normal, color);
        }
    }
    welder.finish(stl_metadata("binary", &header, count, has_colors))
}

/// `parseFloat` semantics: the longest numeric prefix, NaN when there is none.
#[inline]
fn parse_float_prefix(token: &[u8]) -> f64 {
    match fast_float::parse_partial::<f64, _>(token) {
        Ok((value, consumed)) if consumed > 0 => value,
        _ => f64::NAN,
    }
}

/// Lines with surrounding whitespace trimmed and blank lines dropped, which is
/// how the TypeScript parser saw the file.
fn trimmed_lines(data: &[u8]) -> impl Iterator<Item = &[u8]> {
    data.split(|&b| b == b'\n')
        .map(<[u8]>::trim_ascii)
        .filter(|line| !line.is_empty())
}

fn tokens(line: &[u8]) -> impl Iterator<Item = &[u8]> {
    line.split(u8::is_ascii_whitespace)
        .filter(|token| !token.is_empty())
}

fn starts_with_ignore_case(line: &[u8], prefix: &[u8]) -> bool {
    line.len() >= prefix.len() && line[..prefix.len()].eq_ignore_ascii_case(prefix)
}

fn contains_ignore_case(line: &[u8], needle: &[u8]) -> bool {
    line.windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle))
}

/// `keyword a b c` with exactly that keyword first; the three numbers follow.
fn keyword_triple(line: &[u8], keyword: &[&[u8]]) -> Option<[f64; 3]> {
    let mut it = tokens(line);
    for word in keyword {
        if !it.next()?.eq_ignore_ascii_case(word) {
            return None;
        }
    }
    let a = it.next()?;
    let b = it.next()?;
    let c = it.next()?;
    Some([
        parse_float_prefix(a),
        parse_float_prefix(b),
        parse_float_prefix(c),
    ])
}

/// One facet: the normal line plus the six lines that must follow it.
fn ascii_facet(lines: &[&[u8]]) -> Option<([f32; 3], [[f64; 3]; 3])> {
    if lines.len() < 7 {
        return None;
    }
    let n = keyword_triple(lines[0], &[b"facet", b"normal"])?;
    if !contains_ignore_case(lines[1], b"outer loop") {
        return None;
    }
    let a = keyword_triple(lines[2], &[b"vertex"])?;
    let b = keyword_triple(lines[3], &[b"vertex"])?;
    let c = keyword_triple(lines[4], &[b"vertex"])?;
    if !contains_ignore_case(lines[5], b"endloop") || !contains_ignore_case(lines[6], b"endfacet") {
        return None;
    }
    Some(([n[0] as f32, n[1] as f32, n[2] as f32], [a, b, c]))
}

fn parse_ascii_stl(data: &[u8]) -> MeshResult {
    let lines: Vec<&[u8]> = trimmed_lines(data).collect();
    let mut cursor = 0usize;
    let mut header = String::new();
    if let Some(first) = lines.first() {
        if starts_with_ignore_case(first, b"solid ") {
            header = String::from_utf8_lossy(&first[6..]).trim().to_string();
            cursor = 1;
        }
    }
    let mut welder = StlWelder::<Key64>::with_triangles(lines.len() / 7);
    let mut count = 0usize;
    while cursor < lines.len() {
        let line = lines[cursor];
        if starts_with_ignore_case(line, b"facet normal") {
            if let Some((normal, corners)) = ascii_facet(&lines[cursor..]) {
                for corner in &corners {
                    let key = Key64([
                        weld_bits(corner[0]),
                        weld_bits(corner[1]),
                        weld_bits(corner[2]),
                    ]);
                    let xyz = [corner[0] as f32, corner[1] as f32, corner[2] as f32];
                    welder.push_corner(key, xyz, normal, [STL_GREY; 3]);
                }
                count += 1;
                cursor += 7;
            } else {
                cursor += 1;
            }
        } else if starts_with_ignore_case(line, b"endsolid") {
            break;
        } else {
            cursor += 1;
        }
    }
    welder.finish(stl_metadata("ascii", &header, count, false))
}

/// `parseInt` semantics for OFF counts and indices: an optional sign and the
/// leading digits; `None` where JavaScript would produce NaN.
fn parse_int_prefix(token: &[u8]) -> Option<i64> {
    let (negative, digits) = match token.first() {
        Some(b'-') => (true, &token[1..]),
        Some(b'+') => (false, &token[1..]),
        _ => (false, token),
    };
    let end = digits
        .iter()
        .position(|b| !b.is_ascii_digit())
        .unwrap_or(digits.len());
    if end == 0 {
        return None;
    }
    let mut value: i64 = 0;
    for &d in &digits[..end] {
        value = value.saturating_mul(10).saturating_add(i64::from(d - b'0'));
    }
    Some(if negative { -value } else { value })
}

#[inline]
fn color_channel(token: &[u8]) -> u8 {
    // Math.round(Math.min(255, Math.max(0, parseFloat(x)))) - NaN stays NaN in
    // JavaScript and became 0 in the colour buffer.
    let value = parse_float_prefix(token);
    if value.is_nan() {
        0
    } else {
        // JS Math.round rounds half up; f64::round rounds half away from zero,
        // which agrees on the clamped (non-negative) range.
        value.clamp(0.0, 255.0).round() as u8
    }
}

/// Parse an ASCII OFF mesh (OFF, COFF, NOFF, CNOFF).
///
/// # Errors
/// Rejects a malformed header, counts, vertex row or face with the message the
/// viewer shows.
#[wasm_bindgen]
pub fn parse_off(data: &[u8]) -> Result<MeshResult, JsValue> {
    parse_off_native(data).map_err(|message| JsValue::from_str(&message))
}

/// What an OFF header declares, and where the vertex rows begin.
struct OffHeader {
    variant: &'static str,
    has_colors: bool,
    has_normals: bool,
    vertex_count: usize,
    face_count: usize,
    comments: Vec<String>,
    body: usize,
}

fn display_count(value: Option<i64>) -> String {
    value.map_or_else(|| "NaN".to_string(), |v| v.to_string())
}

fn parse_off_header(lines: &[&[u8]]) -> Result<OffHeader, String> {
    let first_line = lines.first().ok_or("Empty OFF file")?;
    let first = String::from_utf8_lossy(first_line).to_uppercase();
    let first_tokens: Vec<&str> = first.split_whitespace().collect();
    let (variant, has_colors, has_normals) = match first.as_str() {
        "OFF" => ("OFF", false, false),
        "COFF" => ("COFF", true, false),
        "NOFF" => ("NOFF", false, true),
        "CNOFF" => ("CNOFF", true, true),
        // Some writers put the counts on the header line itself.
        _ if first_tokens.first() == Some(&"OFF") && first_tokens.len() >= 4 => {
            ("OFF", false, false)
        }
        _ => {
            return Err(format!(
                "Invalid OFF file: expected OFF header, got \"{first}\""
            ))
        }
    };
    let mut cursor = 1usize;
    let mut comments = Vec::new();
    while cursor < lines.len() && lines[cursor].first() == Some(&b'#') {
        comments.push(
            String::from_utf8_lossy(&lines[cursor][1..])
                .trim()
                .to_string(),
        );
        cursor += 1;
    }
    let counts: Vec<Option<i64>> = if first_tokens.len() >= 4 {
        first_tokens[1..4]
            .iter()
            .map(|t| parse_int_prefix(t.as_bytes()))
            .collect()
    } else {
        let line = lines
            .get(cursor)
            .ok_or("OFF file: missing vertex/face/edge counts")?;
        let parts: Vec<&[u8]> = tokens(line).collect();
        if parts.len() < 3 {
            return Err("OFF file: invalid vertex/face/edge counts".into());
        }
        cursor += 1;
        parts[..3].iter().map(|t| parse_int_prefix(t)).collect()
    };
    let (Some(vertices), Some(faces)) = (counts[0], counts[1]) else {
        return Err(format!(
            "OFF file: invalid counts - vertices: {}, faces: {}",
            display_count(counts[0]),
            display_count(counts[1])
        ));
    };
    Ok(OffHeader {
        variant,
        has_colors,
        has_normals,
        vertex_count: vertices.max(0) as usize,
        face_count: faces.max(0) as usize,
        comments,
        body: cursor,
    })
}

#[inline]
fn float3(parts: &[&[u8]], at: usize) -> [f32; 3] {
    [
        parse_float_prefix(parts[at]) as f32,
        parse_float_prefix(parts[at + 1]) as f32,
        parse_float_prefix(parts[at + 2]) as f32,
    ]
}

/// Vertex rows: positions, plus normals and colours where the variant declares
/// them. Returns the cursor just past the last vertex row.
fn parse_off_vertices(
    lines: &[&[u8]],
    header: &OffHeader,
    mesh: &mut MeshResult,
) -> Result<usize, String> {
    // Column positions per variant, and how many columns a complete row has.
    // Missing optional columns stay zero, as they did in the typed buffers the
    // viewer built from the old vertex objects.
    let (normal_at, color_at, needed) = match (header.has_normals, header.has_colors) {
        (true, false) => (Some(3), None, 6),
        (true, true) => (Some(3), Some(6), 9),
        (false, true) => (None, Some(3), 6),
        (false, false) => (None, None, 3),
    };
    let mut cursor = header.body;
    let mut parts: Vec<&[u8]> = Vec::with_capacity(16);
    let end = lines.len().min(header.body + header.vertex_count);
    while cursor < end {
        parts.clear();
        parts.extend(tokens(lines[cursor]));
        if parts.len() < 3 {
            return Err(format!(
                "OFF file: invalid vertex at line {} - expected at least 3 coordinates, got {}",
                cursor + 1,
                parts.len()
            ));
        }
        mesh.positions.extend(float3(&parts, 0));
        let complete = parts.len() >= needed;
        if let Some(at) = normal_at {
            mesh.normals.extend(if complete {
                float3(&parts, at)
            } else {
                [0.0; 3]
            });
        }
        if let Some(at) = color_at {
            mesh.colors.extend(if complete {
                [
                    color_channel(parts[at]),
                    color_channel(parts[at + 1]),
                    color_channel(parts[at + 2]),
                ]
            } else {
                [0; 3]
            });
        }
        cursor += 1;
    }
    Ok(cursor)
}

/// Face rows, fan-triangulated into `mesh.indices`.
fn parse_off_faces(
    lines: &[&[u8]],
    start: usize,
    header: &OffHeader,
    mesh: &mut MeshResult,
) -> Result<(), String> {
    let mut polygon: Vec<u32> = Vec::with_capacity(16);
    let end = lines.len().min(start + header.face_count);
    for (row, line) in lines.iter().enumerate().take(end).skip(start) {
        let line_number = row + 1;
        let mut it = tokens(line);
        let size = it.next().and_then(parse_int_prefix).unwrap_or(0).max(0) as usize;
        polygon.clear();
        for _ in 0..size {
            let Some(token) = it.next() else {
                return Err(format!(
                    "OFF file: face at line {line_number} expects {size} vertices but only has {}",
                    polygon.len()
                ));
            };
            match parse_int_prefix(token) {
                Some(index) if index >= 0 && (index as usize) < header.vertex_count => {
                    polygon.push(index as u32);
                }
                other => {
                    return Err(format!(
                        "OFF file: invalid vertex index {} in face at line {line_number}",
                        display_count(other)
                    ))
                }
            }
        }
        for k in 1..polygon.len().saturating_sub(1) {
            mesh.indices
                .extend([polygon[0], polygon[k], polygon[k + 1]]);
        }
    }
    Ok(())
}

/// [`parse_off`] for native callers and tests.
///
/// # Errors
/// See [`parse_off`].
pub fn parse_off_native(data: &[u8]) -> Result<MeshResult, String> {
    let lines: Vec<&[u8]> = trimmed_lines(data).collect();
    let header = parse_off_header(&lines)?;
    let optional = |enabled: bool| if enabled { header.vertex_count * 3 } else { 0 };
    let comment_json: Vec<String> = header.comments.iter().map(|c| json_string(c)).collect();
    let mut mesh = MeshResult {
        positions: Vec::with_capacity(header.vertex_count * 3),
        normals: Vec::with_capacity(optional(header.has_normals)),
        colors: Vec::with_capacity(optional(header.has_colors)),
        indices: Vec::with_capacity(header.face_count * 3),
        has_normals: header.has_normals,
        has_colors: header.has_colors,
        metadata: format!(
            "{{\"variant\":\"{}\",\"comments\":[{}]}}",
            header.variant,
            comment_json.join(",")
        ),
    };
    let faces_start = parse_off_vertices(&lines, &header, &mut mesh)?;
    parse_off_faces(&lines, faces_start, &header, &mut mesh)?;
    Ok(mesh)
}

#[cfg(test)]
mod tests {
    use super::*;

    type Facet = ([f32; 3], [[f32; 3]; 3], u16);

    fn binary_stl(triangles: &[Facet]) -> Vec<u8> {
        let mut out = vec![0u8; 80];
        out[..4].copy_from_slice(b"test");
        out.extend((triangles.len() as u32).to_le_bytes());
        for (normal, corners, attribute) in triangles {
            for v in normal {
                out.extend(v.to_le_bytes());
            }
            for corner in corners {
                for v in corner {
                    out.extend(v.to_le_bytes());
                }
            }
            out.extend(attribute.to_le_bytes());
        }
        out
    }

    #[test]
    fn binary_stl_welds_shared_corners_in_first_seen_order() {
        let a = [0.0, 0.0, 0.0];
        let b = [1.0, 0.0, 0.0];
        let c = [0.0, 1.0, 0.0];
        let d = [1.0, 1.0, 0.0];
        let data = binary_stl(&[
            ([0.0, 0.0, 1.0], [a, b, c], 0),
            ([0.0, 0.0, -1.0], [b, d, c], 0),
        ]);
        let mut mesh = parse_stl(&data);
        assert_eq!(mesh.vertex_count(), 4);
        assert_eq!(mesh.take_indices(), vec![0, 1, 2, 1, 3, 2]);
        // d is introduced by the second facet, so it carries that normal.
        let normals = mesh.take_normals();
        assert_eq!(&normals[9..12], &[0.0, 0.0, -1.0]);
        assert_eq!(&normals[3..6], &[0.0, 0.0, 1.0]);
        assert_eq!(mesh.take_colors(), vec![STL_GREY; 12]);
    }

    #[test]
    fn binary_stl_merges_negative_zero_like_the_string_key_did() {
        let data = binary_stl(&[(
            [0.0; 3],
            [[0.0, 0.0, 0.0], [-0.0, 0.0, 0.0], [1.0, 0.0, 0.0]],
            0,
        )]);
        let mesh = parse_stl(&data);
        assert_eq!(mesh.vertex_count(), 2);
    }

    #[test]
    fn binary_stl_decodes_rgb565_attribute_colours() {
        let red = 0xf800_u16; // RGB565 pure red
        let data = binary_stl(&[([0.0; 3], [[0.0; 3], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], red)]);
        let mut mesh = parse_stl(&data);
        assert!(mesh.metadata_json().contains("\"sourceHasColors\":true"));
        assert_eq!(&mesh.take_colors()[..3], &[248, 0, 0]);
    }

    #[test]
    fn binary_stl_keeps_the_triangles_a_truncated_file_holds() {
        let mut data = binary_stl(&[
            ([0.0; 3], [[0.0; 3], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], 0),
            ([0.0; 3], [[0.0; 3], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]], 0),
        ]);
        data.truncate(data.len() - 10);
        assert_eq!(parse_stl(&data).triangle_count(), 1);
    }

    #[test]
    fn ascii_stl_parses_facets_and_reads_the_header() {
        let text = b"solid cube\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 1 0 0\n   vertex 0 1 0\n  endloop\n endfacet\nendsolid cube\n";
        let mut mesh = parse_stl(text);
        assert_eq!(mesh.triangle_count(), 1);
        assert!(mesh.metadata_json().contains("\"header\":\"cube\""));
        assert!(mesh.metadata_json().contains("\"format\":\"ascii\""));
        assert_eq!(
            mesh.take_positions(),
            vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
        );
    }

    #[test]
    fn ascii_stl_skips_a_malformed_facet_and_continues() {
        let text = b"solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0\nendloop\nendfacet\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid\n";
        assert_eq!(parse_stl(text).triangle_count(), 1);
    }

    #[test]
    fn off_fan_triangulates_polygons_and_reads_colours() {
        let text = b"COFF\n# made by hand\n4 1 0\n0 0 0 255 0 0\n1 0 0 0 255 0\n1 1 0 0 0 255\n0 1 0 300 -5 1.6\n4 0 1 2 3\n";
        let mut mesh = parse_off_native(text).unwrap();
        assert_eq!(mesh.take_indices(), vec![0, 1, 2, 0, 2, 3]);
        assert_eq!(&mesh.take_colors()[9..], &[255, 0, 2]);
        assert!(mesh
            .metadata_json()
            .contains("\"comments\":[\"made by hand\"]"));
    }

    #[test]
    fn off_rejects_out_of_range_indices() {
        let text = b"OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 3\n";
        let error = parse_off_native(text).err().unwrap();
        assert!(error.contains("invalid vertex index 3"), "{error}");
    }

    #[test]
    fn off_accepts_counts_on_the_header_line() {
        let text = b"OFF 3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n";
        assert_eq!(parse_off_native(text).unwrap().triangle_count(), 1);
    }
}
