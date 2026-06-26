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

// ---------------------------------------------------------------------------
// Zero-copy entry points: JS reads the file straight into WASM memory (via
// `alloc`) and parses in place with `parse_at`, avoiding the extra JS->WASM
// copy and halving peak memory. `format` is one of
// "xyz" | "xyzn" | "xyzrgb" | "ply" | "pcd".
// ---------------------------------------------------------------------------

/// Reserve `len` bytes in WASM memory and return the offset. Caller fills it,
/// passes it to `parse_at`, then releases it with `dealloc`.
#[wasm_bindgen]
pub fn alloc(len: usize) -> usize {
    let mut buf = Vec::<u8>::with_capacity(len);
    let ptr = buf.as_mut_ptr() as usize;
    std::mem::forget(buf);
    ptr
}

/// Free a buffer previously returned by `alloc`.
#[wasm_bindgen]
pub fn dealloc(ptr: usize, len: usize) {
    if ptr != 0 && len != 0 {
        unsafe {
            let _ = Vec::from_raw_parts(ptr as *mut u8, 0, len);
        }
    }
}

/// Parse a buffer already sitting in WASM memory at `ptr`/`len`.
#[wasm_bindgen]
pub fn parse_at(ptr: usize, len: usize, format: &str) -> Result<PointCloudResult, JsValue> {
    let data = unsafe { std::slice::from_raw_parts(ptr as *const u8, len) };
    match format {
        "xyz" | "xyzn" | "xyzrgb" => Ok(parse_xyz(data, format)),
        "ply" => parse_ascii_ply(data),
        "pcd" => parse_pcd_ascii(data),
        other => Err(JsValue::from_str(&format!("unknown format: {other}"))),
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

/// How to interpret separate R/G/B color values.
#[derive(Clone, Copy, PartialEq)]
enum ColorMode {
    /// No type info (XYZ): guess per row — values all ≤ 1 are 0..1, else 0..255.
    Auto,
    /// Declared integer color (PLY `uchar`, PCD `TYPE U`): take values as 0..255.
    Byte,
    /// Declared float color (PLY `float`, PCD `TYPE F`): values are 0..1, scale ×255.
    Unit,
}

/// Map a PLY color property type to a ColorMode. Unknown/exotic integer widths
/// (ushort/uint…) stay Auto so behavior there is unchanged.
fn ply_color_mode(ty: &str) -> ColorMode {
    match ty {
        "float" | "float32" | "double" | "float64" => ColorMode::Unit,
        "uchar" | "uint8" | "char" | "int8" => ColorMode::Byte,
        _ => ColorMode::Auto,
    }
}

/// Map a PCD field TYPE char (b'F'/b'U'/b'I') to a ColorMode for separate r/g/b.
fn pcd_color_mode(ty: u8) -> ColorMode {
    match ty {
        b'F' => ColorMode::Unit,
        b'U' | b'I' => ColorMode::Byte,
        _ => ColorMode::Auto,
    }
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

/// Output accumulator: the packed typed arrays + bbox, with per-row appends.
/// Shared by the whole-buffer `parse_rows` and the streaming `StreamParser`.
struct Builder {
    layout: Vec<Col>,
    ncol: usize,
    uses_packed: bool,
    has_colors: bool,
    has_normals: bool,
    has_intensity: bool,
    positions: Vec<f32>,
    colors: Vec<u8>,
    normals: Vec<f32>,
    intensity: Vec<f32>,
    min: [f32; 3],
    max: [f32; 3],
    color_mode: ColorMode,
}

impl Builder {
    fn new(layout: Vec<Col>, cap: usize, color_mode: ColorMode) -> Self {
        let uses_packed = layout.iter().any(|c| *c == Col::PackedRgb);
        let has_colors =
            uses_packed || layout.iter().any(|c| matches!(c, Col::R | Col::G | Col::B));
        let has_normals = layout.iter().any(|c| matches!(c, Col::Nx | Col::Ny | Col::Nz));
        let has_intensity = layout.iter().any(|c| *c == Col::Intensity);
        let ncol = layout.len();
        Builder {
            layout,
            ncol,
            uses_packed,
            has_colors,
            has_normals,
            has_intensity,
            positions: Vec::with_capacity(cap * 3),
            colors: if has_colors { Vec::with_capacity(cap * 3) } else { Vec::new() },
            normals: if has_normals { Vec::with_capacity(cap * 3) } else { Vec::new() },
            intensity: if has_intensity { Vec::with_capacity(cap) } else { Vec::new() },
            min: [f32::INFINITY; 3],
            max: [f32::NEG_INFINITY; 3],
            color_mode,
        }
    }

    #[inline]
    fn count(&self) -> usize {
        self.positions.len() / 3
    }

    #[inline]
    fn push_row(&mut self, vals: &[f64; 16], n: usize) {
        let mut x = 0f32;
        let mut y = 0f32;
        let mut z = 0f32;
        let (mut r, mut g, mut b) = (0f64, 0f64, 0f64);
        let mut packed: u32 = 0;
        let (mut nx, mut ny, mut nz) = (0f32, 0f32, 0f32);
        let mut inten = 0f32;
        let take = self.ncol.min(n);
        for i in 0..take {
            let v = vals[i];
            match self.layout[i] {
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
        self.positions.push(x);
        self.positions.push(y);
        self.positions.push(z);
        if x < self.min[0] { self.min[0] = x; }
        if y < self.min[1] { self.min[1] = y; }
        if z < self.min[2] { self.min[2] = z; }
        if x > self.max[0] { self.max[0] = x; }
        if y > self.max[1] { self.max[1] = y; }
        if z > self.max[2] { self.max[2] = z; }
        if self.has_colors {
            if self.uses_packed {
                self.colors.push(((packed >> 16) & 0xff) as u8);
                self.colors.push(((packed >> 8) & 0xff) as u8);
                self.colors.push((packed & 0xff) as u8);
            } else {
                // Byte: declared 0..255 ints — take as-is (so dark colors like
                // `1 1 1` aren't mistaken for floats). Unit: declared 0..1 floats
                // — scale ×255. Auto (XYZ, no type info): guess from the values.
                let scale = match self.color_mode {
                    ColorMode::Byte => false,
                    ColorMode::Unit => true,
                    ColorMode::Auto => r <= 1.0 && g <= 1.0 && b <= 1.0,
                };
                let (cr, cg, cb) = if scale {
                    ((r * 255.0).round(), (g * 255.0).round(), (b * 255.0).round())
                } else {
                    (r.round(), g.round(), b.round())
                };
                self.colors.push(cr.clamp(0.0, 255.0) as u8);
                self.colors.push(cg.clamp(0.0, 255.0) as u8);
                self.colors.push(cb.clamp(0.0, 255.0) as u8);
            }
        }
        if self.has_normals {
            self.normals.push(nx);
            self.normals.push(ny);
            self.normals.push(nz);
        }
        if self.has_intensity {
            self.intensity.push(inten);
        }
    }

    fn finish(mut self) -> PointCloudResult {
        let vertex_count = self.count() as u32;
        if vertex_count == 0 {
            self.min = [0.0; 3];
            self.max = [0.0; 3];
        }
        PointCloudResult {
            vertex_count,
            positions: self.positions,
            colors: self.colors,
            normals: self.normals,
            intensity: self.intensity,
            has_colors: self.has_colors,
            has_normals: self.has_normals,
            has_intensity: self.has_intensity,
            min: self.min,
            max: self.max,
        }
    }
}

/// Core whole-buffer row loop. `expected` is a vertex-count hint / stop bound.
/// `cap` pre-sizes the output buffers (avoids reallocations on big parses);
/// `expected` (> 0) caps how many rows are taken (PLY/PCD known counts).
fn parse_rows(
    data: &[u8],
    start: usize,
    layout: &[Col],
    cap: usize,
    expected: usize,
    color_mode: ColorMode,
) -> PointCloudResult {
    let mut b = Builder::new(layout.to_vec(), cap.max(1024), color_mode);
    let mut vals = [0f64; 16];
    let mut pos = start;
    let len = data.len();
    while pos < len {
        // For formats with a known vertex count (PLY), stop before trailing
        // element rows (e.g. faces) so they aren't parsed as bogus vertices.
        if expected > 0 && b.count() >= expected {
            break;
        }
        let n = parse_line(data, &mut pos, &mut vals);
        if n >= 3 {
            b.push_row(&vals, n);
        }
    }
    b.finish()
}

/// Parse all numeric tokens in a single line slice (no newline handling).
#[inline]
fn parse_numbers(line: &[u8], vals: &mut [f64; 16]) -> usize {
    let len = line.len();
    let mut n = 0usize;
    let mut i = 0usize;
    while i < len {
        let c = line[i];
        if is_ws(c) || c == b'\n' {
            i += 1;
            continue;
        }
        match fast_float::parse_partial::<f64, _>(&line[i..]) {
            Ok((v, consumed)) if consumed > 0 => {
                if n < 16 {
                    vals[n] = v;
                }
                n += 1;
                i += consumed;
            }
            _ => {
                while i < len && !is_ws(line[i]) && line[i] != b'\n' {
                    i += 1;
                }
            }
        }
    }
    n
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
    // XYZ has no count header — estimate it from the file size so the output is
    // pre-sized (≈38 bytes/row for xyz, ≈75 for the 6-column variants).
    let bytes_per_row = if layout.len() >= 6 { 75 } else { 35 };
    let cap = data.len() / bytes_per_row;
    parse_rows(data, 0, &layout, cap, 0, ColorMode::Auto)
}

/// Parse a PTS point cloud. PTS has an optional leading count line + comments
/// (both have < 3 numeric columns, so `parse_rows` skips them automatically),
/// then rows auto-detected from the first data row:
///   3 → x y z · 4 → x y z intensity · 6 → x y z r g b ·
///   7 → x y z intensity r g b (Open3D default).
/// Colors are 0-255 integers (the shared 0-1-vs-int heuristic in `Builder`
/// handles the common case; a rare all-channels-≤1 row could be misread — see
/// PERFORMANCE_PLAN raw-int colors note).
#[wasm_bindgen]
pub fn parse_pts(data: &[u8]) -> PointCloudResult {
    let mut vals = [0f64; 16];
    let mut probe = 0usize;
    let mut n = 0usize;
    while probe < data.len() {
        n = parse_line(data, &mut probe, &mut vals);
        if n >= 3 {
            break;
        }
    }
    let layout = match n {
        c if c >= 7 => vec![Col::X, Col::Y, Col::Z, Col::Intensity, Col::R, Col::G, Col::B],
        6 => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
        4 => vec![Col::X, Col::Y, Col::Z, Col::Intensity],
        _ => vec![Col::X, Col::Y, Col::Z],
    };
    let cap = data.len() / 40; // ~bytes per pts row
    parse_rows(data, 0, &layout, cap, 0, ColorMode::Auto)
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
    let mut color_mode = ColorMode::Auto;

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
                let col = ply_col(name);
                // Use the declared type of the (first) color channel instead of
                // guessing from values, so e.g. `property uchar red = 1` isn't
                // mistaken for a 0..1 float.
                if matches!(col, Col::R | Col::G | Col::B) && color_mode == ColorMode::Auto {
                    color_mode = ply_color_mode(parts.first().copied().unwrap_or(""));
                }
                layout.push(col);
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

    Ok(parse_rows(data, data_start, &layout, vertex_count, vertex_count, color_mode))
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
    let mut types: Vec<u8> = Vec::new();
    let mut vertex_count = 0usize;
    for line in header.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("FIELDS ") {
            fields = rest.split_whitespace().collect();
        } else if let Some(rest) = t.strip_prefix("COUNT ") {
            counts = rest.split_whitespace().filter_map(|s| s.parse().ok()).collect();
        } else if let Some(rest) = t.strip_prefix("TYPE ") {
            types = rest.split_whitespace().map(|s| s.bytes().next().unwrap_or(b'F')).collect();
        } else if let Some(rest) = t.strip_prefix("POINTS ") {
            vertex_count = rest.trim().parse().unwrap_or(0);
        }
    }
    if fields.is_empty() {
        return Err(JsValue::from_str("no FIELDS"));
    }
    // Color mode from the declared TYPE of the first separate r/g/b field (packed
    // rgb is always 8-bit and ignores this).
    let mut color_mode = ColorMode::Auto;
    for (i, &name) in fields.iter().enumerate() {
        if matches!(name, "r" | "red" | "g" | "green" | "b" | "blue") {
            color_mode = pcd_color_mode(types.get(i).copied().unwrap_or(b'F'));
            break;
        }
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

    Ok(parse_rows(data, p, &layout, vertex_count, vertex_count, color_mode))
}

/// Read one numeric PCD field as f64. `ty`: b'F' float, b'U' unsigned, b'I'
/// signed. Caller guarantees `o + size <= data.len()`.
#[inline]
fn pcd_read_num(d: &[u8], o: usize, size: usize, ty: u8) -> f64 {
    match (ty, size) {
        (b'F', 4) => f32::from_le_bytes([d[o], d[o + 1], d[o + 2], d[o + 3]]) as f64,
        (b'F', 8) => f64::from_le_bytes([
            d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], d[o + 7],
        ]),
        (b'U', 1) => d[o] as f64,
        (b'U', 2) => u16::from_le_bytes([d[o], d[o + 1]]) as f64,
        (b'U', 4) => u32::from_le_bytes([d[o], d[o + 1], d[o + 2], d[o + 3]]) as f64,
        (b'U', 8) => u64::from_le_bytes([
            d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], d[o + 7],
        ]) as f64,
        (b'I', 1) => (d[o] as i8) as f64,
        (b'I', 2) => i16::from_le_bytes([d[o], d[o + 1]]) as f64,
        (b'I', 4) => i32::from_le_bytes([d[o], d[o + 1], d[o + 2], d[o + 3]]) as f64,
        (b'I', 8) => i64::from_le_bytes([
            d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], d[o + 7],
        ]) as f64,
        _ => 0.0,
    }
}

/// Parse a binary PCD point cloud (`DATA binary`; not `binary_compressed`). Reads
/// the FIELDS/SIZE/TYPE/COUNT header to map each field to a byte offset + reader,
/// then walks fixed-size records straight into the packed output arrays — no
/// text parsing, so it's orders of magnitude faster than the JS binary path.
/// Returns Err (→ JS fallback) for ascii/compressed PCD, missing x/y/z, or a
/// header whose SIZE/TYPE don't line up with FIELDS.
#[wasm_bindgen]
pub fn parse_pcd_binary(data: &[u8]) -> Result<PointCloudResult, JsValue> {
    let data_kw =
        find_subslice(data, b"DATA ").ok_or_else(|| JsValue::from_str("missing DATA line"))?;
    let header = std::str::from_utf8(&data[..data_kw])
        .map_err(|_| JsValue::from_str("non-utf8 header"))?;

    let mut fields: Vec<&str> = Vec::new();
    let mut sizes: Vec<usize> = Vec::new();
    let mut types: Vec<u8> = Vec::new();
    let mut counts: Vec<usize> = Vec::new();
    let mut vertex_count = 0usize;
    for line in header.lines() {
        let t = line.trim();
        if let Some(r) = t.strip_prefix("FIELDS ") {
            fields = r.split_whitespace().collect();
        } else if let Some(r) = t.strip_prefix("SIZE ") {
            sizes = r.split_whitespace().filter_map(|s| s.parse().ok()).collect();
        } else if let Some(r) = t.strip_prefix("TYPE ") {
            types = r.split_whitespace().map(|s| s.bytes().next().unwrap_or(b'F')).collect();
        } else if let Some(r) = t.strip_prefix("COUNT ") {
            counts = r.split_whitespace().filter_map(|s| s.parse().ok()).collect();
        } else if let Some(r) = t.strip_prefix("POINTS ") {
            vertex_count = r.trim().parse().unwrap_or(0);
        }
    }
    let nf = fields.len();
    if nf == 0 || sizes.len() != nf || types.len() != nf {
        return Err(JsValue::from_str("incomplete pcd header"));
    }

    // Only plain binary here; binary_compressed needs the JS path.
    let mut p = data_kw + b"DATA ".len();
    let line_end = {
        let mut e = p;
        while e < data.len() && data[e] != b'\n' {
            e += 1;
        }
        e
    };
    let kind = std::str::from_utf8(&data[p..line_end]).unwrap_or("").trim();
    if kind != "binary" {
        return Err(JsValue::from_str("not plain binary pcd"));
    }
    p = line_end + 1;

    // Field descriptors with byte offset within a record.
    struct FieldDesc {
        col: Col,
        off: usize,
        size: usize,
        ty: u8,
    }
    let mut descs: Vec<FieldDesc> = Vec::with_capacity(nf);
    let mut stride = 0usize;
    for i in 0..nf {
        let cnt = counts.get(i).copied().unwrap_or(1).max(1);
        descs.push(FieldDesc { col: pcd_col(fields[i]), off: stride, size: sizes[i], ty: types[i] });
        stride += sizes[i] * cnt;
    }
    if stride == 0 {
        return Err(JsValue::from_str("zero record stride"));
    }
    if !descs.iter().any(|d| d.col == Col::X) {
        return Err(JsValue::from_str("no x/y/z fields"));
    }

    let uses_packed = descs.iter().any(|d| d.col == Col::PackedRgb);
    let has_colors =
        uses_packed || descs.iter().any(|d| matches!(d.col, Col::R | Col::G | Col::B));
    let has_normals = descs.iter().any(|d| matches!(d.col, Col::Nx | Col::Ny | Col::Nz));
    let has_intensity = descs.iter().any(|d| d.col == Col::Intensity);

    // Clamp to whole records actually present so every read stays in-bounds.
    let avail = data.len().saturating_sub(p) / stride;
    let n = vertex_count.min(avail);

    let mut positions = Vec::with_capacity(n * 3);
    let mut colors = if has_colors { Vec::with_capacity(n * 3) } else { Vec::new() };
    let mut normals = if has_normals { Vec::with_capacity(n * 3) } else { Vec::new() };
    let mut intensity = if has_intensity { Vec::with_capacity(n) } else { Vec::new() };
    let mut min = [f32::INFINITY; 3];
    let mut max = [f32::NEG_INFINITY; 3];

    for i in 0..n {
        let base = p + i * stride;
        let (mut x, mut y, mut z) = (0f32, 0f32, 0f32);
        let (mut nx, mut ny, mut nz) = (0f32, 0f32, 0f32);
        let mut inten = 0f32;
        let (mut cr, mut cg, mut cb) = (0u8, 0u8, 0u8);
        for d in &descs {
            let o = base + d.off;
            match d.col {
                Col::Skip => {}
                Col::X => x = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::Y => y = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::Z => z = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::Nx => nx = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::Ny => ny = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::Nz => nz = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::Intensity => inten = pcd_read_num(data, o, d.size, d.ty) as f32,
                Col::PackedRgb => {
                    // Read the raw 4 bytes as a u32 packing 0x00RRGGBB — works for
                    // both 'F 4' and 'U 4' rgb/rgba with no float round-trip (which
                    // could lose the bits when the packed value is a NaN).
                    let packed = if d.size >= 4 {
                        u32::from_le_bytes([data[o], data[o + 1], data[o + 2], data[o + 3]])
                    } else {
                        0
                    };
                    cr = ((packed >> 16) & 0xff) as u8;
                    cg = ((packed >> 8) & 0xff) as u8;
                    cb = (packed & 0xff) as u8;
                }
                Col::R | Col::G | Col::B => {
                    let v = pcd_read_num(data, o, d.size, d.ty);
                    // Use the declared TYPE: F → 0..1 float (×255), U/I → 0..255.
                    let c = match pcd_color_mode(d.ty) {
                        ColorMode::Unit => (v * 255.0).round(),
                        ColorMode::Byte => v.round(),
                        ColorMode::Auto => {
                            if v <= 1.0 {
                                (v * 255.0).round()
                            } else {
                                v.round()
                            }
                        }
                    };
                    let cc = c.clamp(0.0, 255.0) as u8;
                    match d.col {
                        Col::R => cr = cc,
                        Col::G => cg = cc,
                        _ => cb = cc,
                    }
                }
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
            colors.push(cr);
            colors.push(cg);
            colors.push(cb);
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

    if n == 0 {
        min = [0.0; 3];
        max = [0.0; 3];
    }
    Ok(PointCloudResult {
        vertex_count: n as u32,
        positions,
        colors,
        normals,
        intensity,
        has_colors,
        has_normals,
        has_intensity,
        min,
        max,
    })
}

fn ply_col(name: &str) -> Col {
    match name {
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
    }
}

fn pcd_col(name: &str) -> Col {
    match name {
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
    }
}

enum HeaderState {
    /// Header end-marker not yet present — accumulate more bytes.
    NeedMore,
    /// Unsupported (binary, mesh, no xyz, …) — caller falls back to JS.
    Reject,
    /// (column layout, vertex count, byte offset where data rows begin, color mode)
    Ready(Vec<Col>, usize, usize, ColorMode),
}

fn ply_header_stream(buf: &[u8]) -> HeaderState {
    let header_end = match find_subslice(buf, b"end_header") {
        Some(p) => p,
        None => return HeaderState::NeedMore,
    };
    let mut data_start = header_end + b"end_header".len();
    while data_start < buf.len() && (buf[data_start] == b'\n' || buf[data_start] == b'\r') {
        data_start += 1;
    }
    let header = match std::str::from_utf8(&buf[..header_end]) {
        Ok(h) => h,
        Err(_) => return HeaderState::Reject,
    };
    let mut format_ascii = false;
    let mut in_vertex = false;
    let mut vertex_count = 0usize;
    let mut face_count = 0usize;
    let mut layout: Vec<Col> = Vec::new();
    let mut color_mode = ColorMode::Auto;
    for line in header.lines() {
        let t = line.trim();
        let mut it = t.split_whitespace();
        match it.next() {
            Some("format") => format_ascii = it.next() == Some("ascii"),
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
                let parts: Vec<&str> = it.collect();
                let col = ply_col(parts.last().copied().unwrap_or(""));
                if matches!(col, Col::R | Col::G | Col::B) && color_mode == ColorMode::Auto {
                    color_mode = ply_color_mode(parts.first().copied().unwrap_or(""));
                }
                layout.push(col);
            }
            _ => {}
        }
    }
    if !format_ascii || face_count > 0 || !layout.iter().any(|c| *c == Col::X) {
        return HeaderState::Reject;
    }
    HeaderState::Ready(layout, vertex_count, data_start, color_mode)
}

fn pcd_header_stream(buf: &[u8]) -> HeaderState {
    let data_kw = match find_subslice(buf, b"DATA ") {
        Some(p) => p,
        None => return HeaderState::NeedMore,
    };
    let mut line_end = data_kw + b"DATA ".len();
    while line_end < buf.len() && buf[line_end] != b'\n' {
        line_end += 1;
    }
    if line_end >= buf.len() {
        return HeaderState::NeedMore; // DATA line not fully present yet
    }
    let header = match std::str::from_utf8(&buf[..data_kw]) {
        Ok(h) => h,
        Err(_) => return HeaderState::Reject,
    };
    let data_kind = std::str::from_utf8(&buf[data_kw + 5..line_end]).unwrap_or("").trim();
    if data_kind != "ascii" {
        return HeaderState::Reject;
    }
    let data_start = line_end + 1;
    let mut fields: Vec<&str> = Vec::new();
    let mut counts: Vec<usize> = Vec::new();
    let mut types: Vec<u8> = Vec::new();
    let mut vertex_count = 0usize;
    for line in header.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("FIELDS ") {
            fields = rest.split_whitespace().collect();
        } else if let Some(rest) = t.strip_prefix("COUNT ") {
            counts = rest.split_whitespace().filter_map(|s| s.parse().ok()).collect();
        } else if let Some(rest) = t.strip_prefix("TYPE ") {
            types = rest.split_whitespace().map(|s| s.bytes().next().unwrap_or(b'F')).collect();
        } else if let Some(rest) = t.strip_prefix("POINTS ") {
            vertex_count = rest.trim().parse().unwrap_or(0);
        }
    }
    if fields.is_empty() {
        return HeaderState::Reject;
    }
    let mut color_mode = ColorMode::Auto;
    for (i, &name) in fields.iter().enumerate() {
        if matches!(name, "r" | "red" | "g" | "green" | "b" | "blue") {
            color_mode = pcd_color_mode(types.get(i).copied().unwrap_or(b'F'));
            break;
        }
    }
    let mut layout: Vec<Col> = Vec::new();
    for (i, &name) in fields.iter().enumerate() {
        layout.push(pcd_col(name));
        let c = counts.get(i).copied().unwrap_or(1).max(1);
        for _ in 1..c {
            layout.push(Col::Skip);
        }
    }
    if !layout.iter().any(|c| *c == Col::X) {
        return HeaderState::Reject;
    }
    HeaderState::Ready(layout, vertex_count, data_start, color_mode)
}

/// Incremental parser for streaming/overlapped loading. JS reads the file in
/// chunks and calls `push` on each (while the next chunk's read is in flight),
/// then `finish`. Partial lines are stitched across chunk boundaries via carry.
#[wasm_bindgen]
pub struct StreamParser {
    format: u8, // 0 = xyz/variant, 1 = ply, 2 = pcd
    builder: Option<Builder>,
    header_done: bool,
    expected: usize,
    carry: Vec<u8>,
    error: bool,
}

#[wasm_bindgen]
impl StreamParser {
    #[wasm_bindgen(constructor)]
    pub fn new(format: &str) -> StreamParser {
        let fmt = match format {
            "ply" => 1u8,
            "pcd" => 2u8,
            _ => 0u8,
        };
        let builder = match format {
            "xyzn" => Some(Builder::new(
                vec![Col::X, Col::Y, Col::Z, Col::Nx, Col::Ny, Col::Nz],
                1 << 20,
                ColorMode::Auto,
            )),
            "xyzrgb" => Some(Builder::new(
                vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
                1 << 20,
                ColorMode::Auto,
            )),
            _ => None, // plain xyz: detect from first row; ply/pcd: after header
        };
        StreamParser {
            format: fmt,
            builder,
            header_done: fmt == 0,
            expected: 0,
            carry: Vec::new(),
            error: false,
        }
    }

    /// True if a parse error occurred; the caller should discard and use the JS
    /// parser (the result from `finish` would be empty/partial).
    #[wasm_bindgen(getter)]
    pub fn failed(&self) -> bool {
        self.error
    }

    pub fn push(&mut self, chunk: &[u8]) {
        if self.error {
            return;
        }
        if !self.header_done {
            // Accumulate header bytes in `carry` until the end-marker appears.
            self.carry.extend_from_slice(chunk);
            let state = if self.format == 1 {
                ply_header_stream(&self.carry)
            } else {
                pcd_header_stream(&self.carry)
            };
            match state {
                HeaderState::NeedMore => {}
                HeaderState::Reject => self.error = true,
                HeaderState::Ready(layout, count, data_start, color_mode) => {
                    self.expected = count;
                    self.builder = Some(Builder::new(layout, count.max(1024), color_mode));
                    self.header_done = true;
                    let buf = std::mem::take(&mut self.carry);
                    self.process_data(&buf[data_start..]);
                }
            }
            return;
        }
        self.process_data(chunk);
    }

    pub fn finish(&mut self) -> PointCloudResult {
        if !self.error && !self.carry.is_empty() {
            let line = std::mem::take(&mut self.carry);
            self.process_line(&line);
        }
        self.builder
            .take()
            .unwrap_or_else(|| Builder::new(vec![Col::X, Col::Y, Col::Z], 0, ColorMode::Auto))
            .finish()
    }
}

impl StreamParser {
    /// Process the data bytes of one chunk, stitching the previous chunk's
    /// trailing partial line (`carry`) onto the first line, and keeping this
    /// chunk's trailing partial line as the new carry. Avoids copying the chunk.
    fn process_data(&mut self, chunk: &[u8]) {
        let len = chunk.len();
        if len == 0 {
            return;
        }
        let mut start = 0usize;
        if !self.carry.is_empty() {
            let mut nl = 0usize;
            while nl < len && chunk[nl] != b'\n' {
                nl += 1;
            }
            if nl >= len {
                // No newline anywhere in this chunk — extend carry and wait.
                self.carry.extend_from_slice(chunk);
                return;
            }
            let mut line = std::mem::take(&mut self.carry);
            line.extend_from_slice(&chunk[..nl]);
            self.process_line(&line);
            start = nl + 1;
        }
        let mut line_start = start;
        let mut i = start;
        while i < len {
            if chunk[i] == b'\n' {
                self.process_line(&chunk[line_start..i]);
                line_start = i + 1;
            }
            i += 1;
        }
        if line_start < len {
            self.carry.extend_from_slice(&chunk[line_start..]);
        }
    }

    fn process_line(&mut self, line: &[u8]) {
        if self.error || line.is_empty() {
            return;
        }
        let mut vals = [0f64; 16];
        let n = parse_numbers(line, &mut vals);
        if n < 3 {
            return;
        }
        if self.builder.is_none() {
            // Plain xyz: decide the layout from the first valid row.
            let layout = match n {
                c if c >= 6 => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
                4 => vec![Col::X, Col::Y, Col::Z, Col::Intensity],
                _ => vec![Col::X, Col::Y, Col::Z],
            };
            self.builder = Some(Builder::new(layout, 1 << 20, ColorMode::Auto));
        }
        let expected = self.expected;
        if let Some(b) = self.builder.as_mut() {
            if expected > 0 && b.count() >= expected {
                return;
            }
            b.push_row(&vals, n);
        }
    }
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack
        .windows(needle.len())
        .position(|w| w == needle)
}
