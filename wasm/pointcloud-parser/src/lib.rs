//! Fast WebAssembly parser for ASCII point-cloud formats.
//!
//! Supports plain XYZ, XYZN (x y z nx ny nz), XYZRGB (x y z r g b) and ASCII
//! PLY. Designed to be a drop-in accelerator for the JS parsers: it reads the
//! raw bytes and returns packed typed arrays (positions f32, colors u8, normals
//! f32, intensity f32) plus the bounding box, all computed in one pass.
//!
//! Numbers are parsed with the `fast-float` crate (Eisel–Lemire), which is
//! dramatically faster than a hand-rolled JS atof and fully correct for signs,
//! decimals and scientific notation.
//!
//! New formats that are "rows of whitespace-separated numbers" are easy to add:
//! parse a column layout, then reuse `parse_rows`.

use std::mem;
use wasm_bindgen::prelude::*;

/// Parsed point cloud, returned to JS. Large buffers are moved out with the
/// `take_*` methods (no clone) the way wasm-bindgen marshals `Vec<T>`.
#[wasm_bindgen]
pub struct PointCloudResult {
    vertex_count: u32,
    positions: Vec<f32>,
    colors: Vec<u8>,
    normals: Vec<f32>,
    intensity: Vec<f32>,
    has_colors: bool,
    has_normals: bool,
    has_intensity: bool,
    min: [f32; 3],
    max: [f32; 3],
}

#[wasm_bindgen]
impl PointCloudResult {
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }
    #[wasm_bindgen(getter)]
    pub fn has_colors(&self) -> bool {
        self.has_colors
    }
    #[wasm_bindgen(getter)]
    pub fn has_normals(&self) -> bool {
        self.has_normals
    }
    #[wasm_bindgen(getter)]
    pub fn has_intensity(&self) -> bool {
        self.has_intensity
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        mem::take(&mut self.positions)
    }
    pub fn take_colors(&mut self) -> Vec<u8> {
        mem::take(&mut self.colors)
    }
    pub fn take_normals(&mut self) -> Vec<f32> {
        mem::take(&mut self.normals)
    }
    pub fn take_intensity(&mut self) -> Vec<f32> {
        mem::take(&mut self.intensity)
    }
    /// [min_x, min_y, min_z, max_x, max_y, max_z]
    pub fn bbox(&self) -> Vec<f32> {
        vec![
            self.min[0], self.min[1], self.min[2], self.max[0], self.max[1], self.max[2],
        ]
    }
}

/// Column meaning for one output slot.
#[derive(Clone, Copy, PartialEq)]
enum Col {
    X,
    Y,
    Z,
    R,
    G,
    B,
    /// PCD-style single column whose float bit-pattern packs 0x00RRGGBB.
    PackedRgb,
    Nx,
    Ny,
    Nz,
    Intensity,
    Skip,
}

#[inline(always)]
fn is_ws(c: u8) -> bool {
    c == b' ' || c == b'\t' || c == b'\r'
}

/// Parse the numeric columns of the current line into `vals`, advancing `pos`
/// past the trailing newline. Returns how many numbers were found.
#[inline]
fn parse_line(data: &[u8], pos: &mut usize, vals: &mut [f64; 16]) -> usize {
    let len = data.len();
    let mut n = 0usize;
    while *pos < len {
        let c = data[*pos];
        if c == b'\n' {
            *pos += 1;
            break;
        }
        if is_ws(c) {
            *pos += 1;
            continue;
        }
        // A numeric token (fast-float also accepts inf/nan).
        match fast_float::parse_partial::<f64, _>(&data[*pos..]) {
            Ok((val, consumed)) if consumed > 0 => {
                if n < 16 {
                    vals[n] = val;
                }
                n += 1;
                *pos += consumed;
            }
            _ => {
                // Non-numeric token (e.g. a comment) — skip to next ws/newline.
                while *pos < len && data[*pos] != b'\n' && !is_ws(data[*pos]) {
                    *pos += 1;
                }
            }
        }
    }
    n
}

/// Core row loop shared by every format. `layout` maps each input column to its
/// meaning. `expected` is a vertex-count hint for pre-allocation (0 = unknown).
fn parse_rows(data: &[u8], start: usize, layout: &[Col], expected: usize) -> PointCloudResult {
    let uses_packed = layout.iter().any(|c| *c == Col::PackedRgb);
    let has_colors =
        uses_packed || layout.iter().any(|c| matches!(c, Col::R | Col::G | Col::B));
    let has_normals = layout.iter().any(|c| matches!(c, Col::Nx | Col::Ny | Col::Nz));
    let has_intensity = layout.iter().any(|c| *c == Col::Intensity);

    let cap = expected.max(1024);
    let mut positions: Vec<f32> = Vec::with_capacity(cap * 3);
    let mut colors: Vec<u8> = if has_colors { Vec::with_capacity(cap * 3) } else { Vec::new() };
    let mut normals: Vec<f32> = if has_normals { Vec::with_capacity(cap * 3) } else { Vec::new() };
    let mut intensity: Vec<f32> = if has_intensity { Vec::with_capacity(cap) } else { Vec::new() };

    let mut min = [f32::INFINITY; 3];
    let mut max = [f32::NEG_INFINITY; 3];

    let mut vals = [0f64; 16];
    let mut pos = start;
    let len = data.len();
    let ncol = layout.len();

    while pos < len {
        // For formats with a known vertex count (PLY), stop before any trailing
        // element rows (e.g. faces) so they aren't parsed as bogus vertices.
        if expected > 0 && positions.len() / 3 >= expected {
            break;
        }
        let n = parse_line(data, &mut pos, &mut vals);
        if n < 3 {
            continue; // blank / malformed row
        }
        // Pull out the slots we care about by their column index.
        let mut x = 0f32;
        let mut y = 0f32;
        let mut z = 0f32;
        let (mut r, mut g, mut b) = (0f64, 0f64, 0f64);
        let mut packed: u32 = 0;
        let (mut nx, mut ny, mut nz) = (0f32, 0f32, 0f32);
        let mut inten = 0f32;
        let take = ncol.min(n);
        for i in 0..take {
            let v = vals[i];
            match layout[i] {
                Col::X => x = v as f32,
                Col::Y => y = v as f32,
                Col::Z => z = v as f32,
                Col::R => r = v,
                Col::G => g = v,
                Col::B => b = v,
                Col::PackedRgb => packed = (v as f32).to_bits(),
                Col::Nx => nx = v as f32,
                Col::Ny => ny = v as f32,
                Col::Nz => nz = v as f32,
                Col::Intensity => inten = v as f32,
                Col::Skip => {}
            }
        }

        positions.push(x);
        positions.push(y);
        positions.push(z);
        if x < min[0] { min[0] = x; }
        if y < min[1] { min[1] = y; }
        if z < min[2] { min[2] = z; }
        if x > max[0] { max[0] = x; }
        if y > max[1] { max[1] = y; }
        if z > max[2] { max[2] = z; }

        if has_colors {
            if uses_packed {
                // PCD packs rgb as 0x00RRGGBB in a float's bit pattern.
                colors.push(((packed >> 16) & 0xff) as u8);
                colors.push(((packed >> 8) & 0xff) as u8);
                colors.push((packed & 0xff) as u8);
            } else {
                // Open3D writes 0-1 floats; raw integer otherwise.
                let (cr, cg, cb) = if r <= 1.0 && g <= 1.0 && b <= 1.0 {
                    ((r * 255.0).round(), (g * 255.0).round(), (b * 255.0).round())
                } else {
                    (r.round(), g.round(), b.round())
                };
                colors.push(cr.clamp(0.0, 255.0) as u8);
                colors.push(cg.clamp(0.0, 255.0) as u8);
                colors.push(cb.clamp(0.0, 255.0) as u8);
            }
        }
        if has_normals {
            normals.push(nx);
            normals.push(ny);
            normals.push(nz);
        }
        if has_intensity {
            intensity.push(inten);
        }
    }

    let vertex_count = (positions.len() / 3) as u32;
    if vertex_count == 0 {
        min = [0.0; 3];
        max = [0.0; 3];
    }
    PointCloudResult {
        vertex_count,
        positions,
        colors,
        normals,
        intensity,
        has_colors,
        has_normals,
        has_intensity,
        min,
        max,
    }
}

/// Parse XYZ / XYZN / XYZRGB. For plain "xyz" the layout is auto-detected from
/// the first valid row (3 = xyz, 4 = xyz+intensity, 6 = xyz+rgb).
#[wasm_bindgen]
pub fn parse_xyz(data: &[u8], variant: &str) -> PointCloudResult {
    let layout: Vec<Col> = match variant {
        "xyzn" => vec![Col::X, Col::Y, Col::Z, Col::Nx, Col::Ny, Col::Nz],
        "xyzrgb" => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
        _ => {
            // Auto-detect from the first valid row.
            let mut vals = [0f64; 16];
            let mut probe = 0usize;
            let mut n = 0usize;
            while probe < data.len() {
                n = parse_line(data, &mut probe, &mut vals);
                if n >= 3 {
                    break;
                }
            }
            match n {
                c if c >= 6 => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
                4 => vec![Col::X, Col::Y, Col::Z, Col::Intensity],
                _ => vec![Col::X, Col::Y, Col::Z],
            }
        }
    };
    parse_rows(data, 0, &layout, 0)
}

/// Parse an ASCII PLY: read the header to learn the vertex count + property
/// order, then parse the vertex rows. Falls back to an error string the JS side
/// can catch (and use its own parser) on anything unexpected.
#[wasm_bindgen]
pub fn parse_ascii_ply(data: &[u8]) -> Result<PointCloudResult, JsValue> {
    // Find "end_header" and the byte just after its newline.
    let header_end = find_subslice(data, b"end_header")
        .ok_or_else(|| JsValue::from_str("missing end_header"))?;
    let mut data_start = header_end + b"end_header".len();
    while data_start < data.len() && (data[data_start] == b'\n' || data[data_start] == b'\r') {
        data_start += 1;
    }

    let header = std::str::from_utf8(&data[..header_end])
        .map_err(|_| JsValue::from_str("non-utf8 header"))?;

    let mut format_ascii = false;
    let mut in_vertex = false;
    let mut vertex_count = 0usize;
    let mut face_count = 0usize;
    let mut layout: Vec<Col> = Vec::new();

    for line in header.lines() {
        let t = line.trim();
        let mut it = t.split_whitespace();
        match it.next() {
            Some("format") => {
                format_ascii = it.next() == Some("ascii");
            }
            Some("element") => {
                let name = it.next().unwrap_or("");
                in_vertex = name == "vertex";
                let count = it.next().and_then(|s| s.parse().ok()).unwrap_or(0);
                if in_vertex {
                    vertex_count = count;
                } else if name == "face" {
                    face_count = count;
                }
            }
            Some("property") if in_vertex => {
                // property <type> <name>  (list properties don't occur for vertices)
                let parts: Vec<&str> = it.collect();
                let name = parts.last().copied().unwrap_or("");
                layout.push(match name {
                    "x" => Col::X,
                    "y" => Col::Y,
                    "z" => Col::Z,
                    "red" | "r" => Col::R,
                    "green" | "g" => Col::G,
                    "blue" | "b" => Col::B,
                    "nx" => Col::Nx,
                    "ny" => Col::Ny,
                    "nz" => Col::Nz,
                    "intensity" | "reflectivity" | "reflectance" | "remission" => Col::Intensity,
                    _ => Col::Skip,
                });
            }
            _ => {}
        }
    }

    if !format_ascii {
        return Err(JsValue::from_str("not ascii ply"));
    }
    if face_count > 0 {
        // Meshes need face handling the JS parser provides — let it take over.
        return Err(JsValue::from_str("ply has faces; use mesh parser"));
    }
    if !layout.iter().any(|c| *c == Col::X) {
        return Err(JsValue::from_str("no x/y/z properties"));
    }

    Ok(parse_rows(data, data_start, &layout, vertex_count))
}

/// Parse an ASCII PCD point cloud. Reads the FIELDS/COUNT header to build a
/// column layout (including PCD's packed-float `rgb`), then parses the rows.
/// Returns an error (→ JS fallback) for binary PCD or anything unsupported.
#[wasm_bindgen]
pub fn parse_pcd_ascii(data: &[u8]) -> Result<PointCloudResult, JsValue> {
    let data_kw = find_subslice(data, b"DATA ")
        .ok_or_else(|| JsValue::from_str("missing DATA line"))?;
    // Header is everything up to the DATA line.
    let header = std::str::from_utf8(&data[..data_kw])
        .map_err(|_| JsValue::from_str("non-utf8 header"))?;

    let mut fields: Vec<&str> = Vec::new();
    let mut counts: Vec<usize> = Vec::new();
    let mut vertex_count = 0usize;
    for line in header.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("FIELDS ") {
            fields = rest.split_whitespace().collect();
        } else if let Some(rest) = t.strip_prefix("COUNT ") {
            counts = rest.split_whitespace().filter_map(|s| s.parse().ok()).collect();
        } else if let Some(rest) = t.strip_prefix("POINTS ") {
            vertex_count = rest.trim().parse().unwrap_or(0);
        }
    }
    if fields.is_empty() {
        return Err(JsValue::from_str("no FIELDS"));
    }

    // Confirm DATA is ascii, and find the byte after that line's newline.
    let mut p = data_kw + b"DATA ".len();
    let line_end = {
        let mut e = p;
        while e < data.len() && data[e] != b'\n' {
            e += 1;
        }
        e
    };
    let data_kind = std::str::from_utf8(&data[p..line_end]).unwrap_or("").trim();
    if data_kind != "ascii" {
        return Err(JsValue::from_str("not ascii pcd"));
    }
    p = line_end + 1;

    // Build the column layout, expanding COUNT>1 fields (extra columns skipped).
    let mut layout: Vec<Col> = Vec::new();
    for (i, &name) in fields.iter().enumerate() {
        let col = match name {
            "x" => Col::X,
            "y" => Col::Y,
            "z" => Col::Z,
            "rgb" | "rgba" => Col::PackedRgb,
            "r" | "red" => Col::R,
            "g" | "green" => Col::G,
            "b" | "blue" => Col::B,
            "normal_x" | "nx" => Col::Nx,
            "normal_y" | "ny" => Col::Ny,
            "normal_z" | "nz" => Col::Nz,
            "intensity" => Col::Intensity,
            _ => Col::Skip,
        };
        let c = counts.get(i).copied().unwrap_or(1).max(1);
        layout.push(col);
        for _ in 1..c {
            layout.push(Col::Skip);
        }
    }
    if !layout.iter().any(|c| *c == Col::X) {
        return Err(JsValue::from_str("no x/y/z fields"));
    }

    Ok(parse_rows(data, p, &layout, vertex_count))
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack
        .windows(needle.len())
        .position(|w| w == needle)
}
