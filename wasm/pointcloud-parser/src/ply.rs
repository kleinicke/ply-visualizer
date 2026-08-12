//! PLY parsing: header, ASCII and binary bodies, faces and scalar fields.
//!
//! This is the whole format in one place. The TypeScript parser this replaces
//! had a separate loop per encoding, each with its own idea of which properties
//! are colour, which are scalar fields, and which belong to a Gaussian splat —
//! and the crate previously handled only the ASCII half, which is how the two
//! came to disagree about extra scalar properties.
//!
//! The parser is a property table, not a per-value type switch: element and
//! property declarations are read once into typed descriptors, and the body
//! loop then indexes them. That is what makes the binary path fast, and it is
//! also what makes list properties and unknown elements skippable rather than
//! fatal.

use wasm_bindgen::prelude::*;

/// Degree-0 spherical-harmonics basis constant. A 3DGS colour channel is
/// `0.5 + SH_C0 * f_dc_i` (the INRIA reference implementation).
const SH_C0: f64 = 0.282_094_791_773_878_14;

/// Names other tools use for what the viewer colours as intensity.
const INTENSITY_ALIASES: [&str; 4] = ["intensity", "reflectivity", "reflectance", "remission"];

/// Properties consumed by position, colour and normal handling; everything else
/// numeric becomes a scalar field the colour UI can map.
const CONSUMED_PROPS: [&str; 10] = [
    "x", "y", "z", "red", "green", "blue", "alpha", "nx", "ny", "nz",
];

#[derive(Clone, Copy, PartialEq, Debug)]
enum ScalarType {
    I8,
    U8,
    I16,
    U16,
    I32,
    U32,
    F32,
    F64,
}

impl ScalarType {
    fn parse(name: &str) -> Option<ScalarType> {
        Some(match name {
            "char" | "int8" => ScalarType::I8,
            "uchar" | "uint8" => ScalarType::U8,
            "short" | "int16" => ScalarType::I16,
            "ushort" | "uint16" => ScalarType::U16,
            "int" | "int32" => ScalarType::I32,
            "uint" | "uint32" => ScalarType::U32,
            "float" | "float32" => ScalarType::F32,
            "double" | "float64" => ScalarType::F64,
            _ => return None,
        })
    }

    fn size(self) -> usize {
        match self {
            ScalarType::I8 | ScalarType::U8 => 1,
            ScalarType::I16 | ScalarType::U16 => 2,
            ScalarType::I32 | ScalarType::U32 | ScalarType::F32 => 4,
            ScalarType::F64 => 8,
        }
    }

    /// True for the byte types PLY uses for 0..255 colour channels.
    fn is_byte(self) -> bool {
        matches!(self, ScalarType::U8 | ScalarType::I8)
    }

    fn is_float(self) -> bool {
        matches!(self, ScalarType::F32 | ScalarType::F64)
    }
}

/// Reads a value of `ty` at `off`, honouring the file's endianness.
fn read_scalar(data: &[u8], off: usize, ty: ScalarType, little: bool) -> f64 {
    macro_rules! bytes {
        ($n:expr) => {{
            let mut b = [0u8; $n];
            b.copy_from_slice(&data[off..off + $n]);
            if !little {
                b.reverse();
            }
            b
        }};
    }
    if off + ty.size() > data.len() {
        return 0.0;
    }
    match ty {
        ScalarType::I8 => data[off] as i8 as f64,
        ScalarType::U8 => data[off] as f64,
        ScalarType::I16 => i16::from_le_bytes(bytes!(2)) as f64,
        ScalarType::U16 => u16::from_le_bytes(bytes!(2)) as f64,
        ScalarType::I32 => i32::from_le_bytes(bytes!(4)) as f64,
        ScalarType::U32 => u32::from_le_bytes(bytes!(4)) as f64,
        ScalarType::F32 => f32::from_le_bytes(bytes!(4)) as f64,
        ScalarType::F64 => f64::from_le_bytes(bytes!(8)),
    }
}

enum Property {
    Scalar {
        name: String,
        ty: ScalarType,
    },
    /// `property list <count type> <index type> <name>`
    List {
        name: String,
        count_ty: ScalarType,
        index_ty: ScalarType,
    },
}

impl Property {
    fn name(&self) -> &str {
        match self {
            Property::Scalar { name, .. } | Property::List { name, .. } => name,
        }
    }
}

struct Element {
    name: String,
    count: usize,
    properties: Vec<Property>,
}

impl Element {
    /// Bytes per record, or None when a list property makes it variable.
    fn fixed_stride(&self) -> Option<usize> {
        let mut stride = 0;
        for p in &self.properties {
            match p {
                Property::Scalar { ty, .. } => stride += ty.size(),
                Property::List { .. } => return None,
            }
        }
        Some(stride)
    }
}

#[derive(PartialEq, Clone, Copy)]
enum Encoding {
    Ascii,
    BinaryLittleEndian,
    BinaryBigEndian,
}

struct PlyHeader {
    encoding: Encoding,
    version: String,
    comments: Vec<String>,
    elements: Vec<Element>,
    data_start: usize,
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack.windows(needle.len()).position(|w| w == needle)
}

fn parse_header(data: &[u8]) -> Result<PlyHeader, String> {
    if !data.starts_with(b"ply") {
        return Err("missing PLY magic".into());
    }
    let end = find_subslice(data, b"end_header").ok_or("missing end_header")?;
    let text = std::str::from_utf8(&data[..end]).map_err(|_| "non-utf8 header")?;

    let mut header = PlyHeader {
        encoding: Encoding::Ascii,
        version: "1.0".into(),
        comments: Vec::new(),
        elements: Vec::new(),
        data_start: 0,
    };

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed == "ply" {
            continue;
        }
        let mut it = trimmed.split_whitespace();
        match it.next().unwrap_or("") {
            "format" => {
                let kind = it.next().unwrap_or("");
                header.encoding = match kind {
                    "ascii" => Encoding::Ascii,
                    "binary_little_endian" => Encoding::BinaryLittleEndian,
                    "binary_big_endian" => Encoding::BinaryBigEndian,
                    other => return Err(format!("unsupported PLY format: {other}")),
                };
                header.version = it.next().unwrap_or("1.0").to_string();
            }
            "comment" => header.comments.push(it.collect::<Vec<_>>().join(" ")),
            "element" => {
                let name = it.next().unwrap_or("").to_string();
                let count = it.next().and_then(|s| s.parse().ok()).unwrap_or(0);
                header.elements.push(Element {
                    name,
                    count,
                    properties: Vec::new(),
                });
            }
            "property" => {
                let element = header
                    .elements
                    .last_mut()
                    .ok_or("property declared before any element")?;
                let parts: Vec<&str> = it.collect();
                if parts.first() == Some(&"list") {
                    // property list <count type> <index type> <name>
                    if parts.len() < 4 {
                        return Err("malformed list property".into());
                    }
                    element.properties.push(Property::List {
                        name: parts[parts.len() - 1].to_string(),
                        count_ty: ScalarType::parse(parts[1])
                            .ok_or_else(|| format!("unsupported list count type: {}", parts[1]))?,
                        index_ty: ScalarType::parse(parts[2])
                            .ok_or_else(|| format!("unsupported list index type: {}", parts[2]))?,
                    });
                } else {
                    if parts.len() < 2 {
                        return Err("malformed property".into());
                    }
                    element.properties.push(Property::Scalar {
                        name: parts[parts.len() - 1].to_string(),
                        ty: ScalarType::parse(parts[0])
                            .ok_or_else(|| format!("unsupported property type: {}", parts[0]))?,
                    });
                }
            }
            _ => {}
        }
    }

    let mut start = end + b"end_header".len();
    while start < data.len() && (data[start] == b'\n' || data[start] == b'\r') {
        start += 1;
    }
    header.data_start = start;
    Ok(header)
}

/// 3DGS layout: colour lives in f_dc_0..2 and there is no explicit red/green/
/// blue (an explicit colour wins when both are present).
fn is_gaussian_splat_layout(properties: &[Property]) -> bool {
    let mut dc = 0;
    for p in properties {
        let name = p.name().to_ascii_lowercase();
        if name == "red" || name == "green" || name == "blue" {
            return false;
        }
        if name == "f_dc_0" || name == "f_dc_1" || name == "f_dc_2" {
            dc += 1;
        }
    }
    dc == 3
}

/// Splat properties that must not become scalar fields: `f_dc_*` is the colour
/// source, `rot_*` is meaningless on its own, and `f_rest_*` (45 properties at
/// SH degree 3) would allocate an array each. `opacity` and `scale_*` stay.
fn is_splat_consumed(name: &str) -> bool {
    name.starts_with("f_dc_") || name.starts_with("f_rest_") || name.starts_with("rot_")
}

fn is_intensity(name: &str) -> bool {
    INTENSITY_ALIASES.contains(&name)
}

fn is_extra_scalar(property: &Property, splat: bool) -> bool {
    match property {
        Property::List { .. } => false,
        Property::Scalar { name, .. } => {
            let lower = name.to_ascii_lowercase();
            let consumed = CONSUMED_PROPS.contains(&lower.as_str())
                || is_intensity(&lower)
                || (splat && is_splat_consumed(&lower));
            !consumed
        }
    }
}

fn sh_dc_to_u8(v: f64) -> u8 {
    let c = (0.5 + SH_C0 * v) * 255.0;
    c.clamp(0.0, 255.0).round() as u8
}

/// What each vertex property contributes to the output.
#[derive(Clone, Copy, PartialEq)]
enum Target {
    X,
    Y,
    Z,
    Red,
    Green,
    Blue,
    Nx,
    Ny,
    Nz,
    Intensity,
    /// Index into the scalar-field arrays.
    Scalar(usize),
    Ignore,
}

/// The vertex element resolved into "where does each property go".
struct VertexPlan {
    targets: Vec<Target>,
    /// Byte offset of each property within a record (binary only).
    offsets: Vec<usize>,
    types: Vec<ScalarType>,
    scalar_names: Vec<String>,
    has_colors: bool,
    has_normals: bool,
    has_intensity: bool,
    is_splat: bool,
    /// True when colours arrive as 0..1 floats rather than 0..255 bytes.
    unit_colors: bool,
    stride: Option<usize>,
}

fn plan_vertex(element: &Element) -> Result<VertexPlan, String> {
    let is_splat = is_gaussian_splat_layout(&element.properties);
    let mut targets = Vec::with_capacity(element.properties.len());
    let mut offsets = Vec::with_capacity(element.properties.len());
    let mut types = Vec::with_capacity(element.properties.len());
    let mut scalar_names = Vec::new();
    let mut has_colors = false;
    let mut has_normals = false;
    let mut has_intensity = false;
    let mut unit_colors = false;
    let mut offset = 0usize;

    for property in &element.properties {
        let (name, ty) = match property {
            Property::Scalar { name, ty } => (name.to_ascii_lowercase(), *ty),
            // A list inside the vertex element cannot be addressed by offset;
            // the record is then walked sequentially and this entry ignored.
            Property::List { .. } => {
                targets.push(Target::Ignore);
                offsets.push(offset);
                types.push(ScalarType::U8);
                continue;
            }
        };
        let target = match name.as_str() {
            "x" => Target::X,
            "y" => Target::Y,
            "z" => Target::Z,
            "red" => Target::Red,
            "green" => Target::Green,
            "blue" => Target::Blue,
            "nx" => Target::Nx,
            "ny" => Target::Ny,
            "nz" => Target::Nz,
            "f_dc_0" if is_splat => Target::Red,
            "f_dc_1" if is_splat => Target::Green,
            "f_dc_2" if is_splat => Target::Blue,
            other if is_intensity(other) => Target::Intensity,
            _ => {
                if is_extra_scalar(property, is_splat) {
                    scalar_names.push(match property {
                        // The scalar field keeps the property's original
                        // spelling: it is what the colour UI shows.
                        Property::Scalar { name, .. } => name.clone(),
                        Property::List { name, .. } => name.clone(),
                    });
                    Target::Scalar(scalar_names.len() - 1)
                } else {
                    Target::Ignore
                }
            }
        };
        match target {
            Target::Red | Target::Green | Target::Blue => {
                has_colors = true;
                // A float colour channel that is not a splat DC coefficient is
                // the 0..1 convention; a byte channel is 0..255.
                if !is_splat && ty.is_float() && !ty.is_byte() {
                    unit_colors = true;
                }
            }
            Target::Nx | Target::Ny | Target::Nz => has_normals = true,
            Target::Intensity => has_intensity = true,
            _ => {}
        }
        targets.push(target);
        offsets.push(offset);
        types.push(ty);
        offset += ty.size();
    }

    if !targets.contains(&Target::X) {
        return Err("PLY vertex element has no x property".into());
    }
    if is_splat {
        // 3DGS exporters write nx/ny/nz as zeros, which would only produce a
        // useless normals array and a no-op Normals button.
        has_normals = false;
    }

    Ok(VertexPlan {
        targets,
        offsets,
        types,
        scalar_names,
        has_colors,
        has_normals,
        has_intensity,
        is_splat,
        unit_colors,
        stride: element.fixed_stride(),
    })
}

/// Parsed PLY, handed to JS. Large buffers move out with the `take_*` methods.
#[wasm_bindgen]
pub struct PlyResult {
    vertex_count: u32,
    face_count: u32,
    positions: Vec<f32>,
    colors: Vec<u8>,
    normals: Vec<f32>,
    intensity: Vec<f32>,
    scalar_names: Vec<String>,
    scalars: Vec<Vec<f32>>,
    /// Flattened face indices, with `face_sizes` giving each face's length.
    face_indices: Vec<u32>,
    face_sizes: Vec<u32>,
    has_colors: bool,
    has_normals: bool,
    has_intensity: bool,
    is_gaussian_splat: bool,
    min: [f32; 3],
    max: [f32; 3],
    metadata: String,
}

#[wasm_bindgen]
impl PlyResult {
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }
    #[wasm_bindgen(getter)]
    pub fn face_count(&self) -> u32 {
        self.face_count
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
    #[wasm_bindgen(getter)]
    pub fn is_gaussian_splat(&self) -> bool {
        self.is_gaussian_splat
    }
    /// Header facts as JSON: format, version and comments.
    #[wasm_bindgen(getter)]
    pub fn metadata_json(&self) -> String {
        self.metadata.clone()
    }
    /// Scalar-field names, in the order `take_scalar_at` expects.
    #[wasm_bindgen(getter)]
    pub fn scalar_field_names(&self) -> Vec<String> {
        self.scalar_names.clone()
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.positions)
    }
    pub fn take_colors(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.colors)
    }
    pub fn take_normals(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.normals)
    }
    pub fn take_intensity(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.intensity)
    }
    pub fn take_scalar_at(&mut self, index: usize) -> Vec<f32> {
        self.scalars
            .get_mut(index)
            .map(std::mem::take)
            .unwrap_or_default()
    }
    pub fn take_face_indices(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.face_indices)
    }
    /// Vertices per face, parallel to the runs in `take_face_indices`.
    pub fn take_face_sizes(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.face_sizes)
    }
    /// [min_x, min_y, min_z, max_x, max_y, max_z]
    pub fn bbox(&self) -> Vec<f32> {
        vec![
            self.min[0],
            self.min[1],
            self.min[2],
            self.max[0],
            self.max[1],
            self.max[2],
        ]
    }
}

/// Accumulates vertices as values arrive, in property order.
struct VertexSink {
    plan: VertexPlan,
    positions: Vec<f32>,
    colors: Vec<u8>,
    normals: Vec<f32>,
    intensity: Vec<f32>,
    scalars: Vec<Vec<f32>>,
    min: [f32; 3],
    max: [f32; 3],
}

impl VertexSink {
    fn new(plan: VertexPlan, count: usize) -> Self {
        let scalars = vec![Vec::with_capacity(count); plan.scalar_names.len()];
        VertexSink {
            positions: Vec::with_capacity(count * 3),
            colors: if plan.has_colors {
                Vec::with_capacity(count * 3)
            } else {
                Vec::new()
            },
            normals: if plan.has_normals {
                Vec::with_capacity(count * 3)
            } else {
                Vec::new()
            },
            intensity: if plan.has_intensity {
                Vec::with_capacity(count)
            } else {
                Vec::new()
            },
            scalars,
            min: [f32::INFINITY; 3],
            max: [f32::NEG_INFINITY; 3],
            plan,
        }
    }

    /// `values[i]` is the value of property `i` for one vertex.
    fn push(&mut self, values: &[f64]) {
        let mut xyz = [0f32; 3];
        let mut rgb = [0u8; 3];
        let mut normal = [0f32; 3];
        let mut inten = 0f32;
        for (i, target) in self.plan.targets.iter().enumerate() {
            let v = match values.get(i) {
                Some(v) => *v,
                None => continue,
            };
            match target {
                Target::X => xyz[0] = v as f32,
                Target::Y => xyz[1] = v as f32,
                Target::Z => xyz[2] = v as f32,
                Target::Red | Target::Green | Target::Blue => {
                    let channel = match target {
                        Target::Red => 0,
                        Target::Green => 1,
                        _ => 2,
                    };
                    rgb[channel] = if self.plan.is_splat {
                        sh_dc_to_u8(v)
                    } else if self.plan.unit_colors {
                        (v * 255.0).clamp(0.0, 255.0).round() as u8
                    } else {
                        v.clamp(0.0, 255.0).round() as u8
                    };
                }
                Target::Nx => normal[0] = v as f32,
                Target::Ny => normal[1] = v as f32,
                Target::Nz => normal[2] = v as f32,
                Target::Intensity => inten = v as f32,
                Target::Scalar(index) => self.scalars[*index].push(v as f32),
                Target::Ignore => {}
            }
        }
        self.positions.extend_from_slice(&xyz);
        for (axis, value) in xyz.iter().enumerate() {
            self.min[axis] = self.min[axis].min(*value);
            self.max[axis] = self.max[axis].max(*value);
        }
        if self.plan.has_colors {
            self.colors.extend_from_slice(&rgb);
        }
        if self.plan.has_normals {
            self.normals.extend_from_slice(&normal);
        }
        if self.plan.has_intensity {
            self.intensity.push(inten);
        }
    }
}

/// Parse a PLY file in either encoding, with faces, scalar fields and 3DGS
/// colour synthesis.
#[wasm_bindgen]
pub fn parse_ply(data: &[u8]) -> Result<PlyResult, JsValue> {
    parse_ply_inner(data).map_err(|e| JsValue::from_str(&e))
}

fn parse_ply_inner(data: &[u8]) -> Result<PlyResult, String> {
    let header = parse_header(data)?;
    let vertex_element = header
        .elements
        .iter()
        .find(|e| e.name == "vertex")
        .ok_or("PLY has no vertex element")?;
    let plan = plan_vertex(vertex_element)?;
    let vertex_count = vertex_element.count;
    let mut sink = VertexSink::new(plan, vertex_count);
    let mut face_indices: Vec<u32> = Vec::new();
    let mut face_sizes: Vec<u32> = Vec::new();

    match header.encoding {
        Encoding::Ascii => {
            read_ascii_body(data, &header, &mut sink, &mut face_indices, &mut face_sizes)?
        }
        _ => read_binary_body(
            data,
            &header,
            header.encoding == Encoding::BinaryLittleEndian,
            &mut sink,
            &mut face_indices,
            &mut face_sizes,
        )?,
    }

    let metadata = format!(
        "{{\"format\":\"{}\",\"version\":\"{}\",\"comments\":[{}]}}",
        match header.encoding {
            Encoding::Ascii => "ascii",
            Encoding::BinaryLittleEndian => "binary_little_endian",
            Encoding::BinaryBigEndian => "binary_big_endian",
        },
        header.version,
        header
            .comments
            .iter()
            .map(|c| format!("\"{}\"", c.replace('\\', "\\\\").replace('"', "\\\"")))
            .collect::<Vec<_>>()
            .join(",")
    );

    let actual = (sink.positions.len() / 3) as u32;
    let (min, max) = if actual == 0 {
        ([0.0; 3], [0.0; 3])
    } else {
        (sink.min, sink.max)
    };
    Ok(PlyResult {
        vertex_count: actual,
        face_count: face_sizes.len() as u32,
        positions: sink.positions,
        colors: sink.colors,
        normals: sink.normals,
        intensity: sink.intensity,
        scalar_names: sink.plan.scalar_names,
        scalars: sink.scalars,
        face_indices,
        face_sizes,
        has_colors: sink.plan.has_colors,
        has_normals: sink.plan.has_normals,
        has_intensity: sink.plan.has_intensity,
        is_gaussian_splat: sink.plan.is_splat,
        min,
        max,
        metadata,
    })
}

/// Reads whitespace-separated numbers, one element record per line.
fn read_ascii_body(
    data: &[u8],
    header: &PlyHeader,
    sink: &mut VertexSink,
    face_indices: &mut Vec<u32>,
    face_sizes: &mut Vec<u32>,
) -> Result<(), String> {
    let mut pos = header.data_start;
    let mut values: Vec<f64> = Vec::new();
    let mut line: Vec<f64> = Vec::new();

    for element in &header.elements {
        for _ in 0..element.count {
            if pos >= data.len() {
                return Ok(()); // truncated file: keep what was read
            }
            line.clear();
            read_ascii_line(data, &mut pos, &mut line);
            if line.is_empty() {
                continue;
            }
            if element.name == "vertex" {
                values.clear();
                values.extend_from_slice(&line);
                sink.push(&values);
            } else if element.name == "face" {
                // The first number is the vertex count of this face.
                let n = line[0].max(0.0) as usize;
                let take = n.min(line.len().saturating_sub(1));
                if take >= 3 {
                    face_sizes.push(take as u32);
                    for v in &line[1..=take] {
                        face_indices.push(*v as u32);
                    }
                }
            }
        }
    }
    Ok(())
}

/// One line's numbers. Blank lines are skipped so a record is never split.
fn read_ascii_line(data: &[u8], pos: &mut usize, out: &mut Vec<f64>) {
    while *pos < data.len() {
        let start = *pos;
        while *pos < data.len() && data[*pos] != b'\n' {
            *pos += 1;
        }
        let line = &data[start..*pos];
        if *pos < data.len() {
            *pos += 1;
        }
        let mut i = 0usize;
        while i < line.len() {
            let c = line[i];
            if c == b' ' || c == b'\t' || c == b'\r' {
                i += 1;
                continue;
            }
            match fast_float::parse_partial::<f64, _>(&line[i..]) {
                Ok((v, consumed)) if consumed > 0 => {
                    out.push(v);
                    i += consumed;
                }
                _ => {
                    while i < line.len() && line[i] != b' ' && line[i] != b'\t' && line[i] != b'\r'
                    {
                        i += 1;
                    }
                }
            }
        }
        if !out.is_empty() {
            return;
        }
    }
}

fn read_binary_body(
    data: &[u8],
    header: &PlyHeader,
    little: bool,
    sink: &mut VertexSink,
    face_indices: &mut Vec<u32>,
    face_sizes: &mut Vec<u32>,
) -> Result<(), String> {
    let mut pos = header.data_start;
    let mut values: Vec<f64> = Vec::new();

    for element in &header.elements {
        if element.name == "vertex" {
            let stride = sink.plan.stride;
            for _ in 0..element.count {
                match stride {
                    Some(stride) => {
                        if pos + stride > data.len() {
                            return Ok(()); // truncated: keep what was read
                        }
                        values.clear();
                        for i in 0..sink.plan.types.len() {
                            values.push(read_scalar(
                                data,
                                pos + sink.plan.offsets[i],
                                sink.plan.types[i],
                                little,
                            ));
                        }
                        sink.push(&values);
                        pos += stride;
                    }
                    // A list property inside the vertex element makes the
                    // record variable-length, so it is walked instead.
                    None => {
                        values.clear();
                        if !read_record_sequential(data, &mut pos, element, little, &mut values) {
                            return Ok(());
                        }
                        sink.push(&values);
                    }
                }
            }
        } else if element.name == "face" {
            for _ in 0..element.count {
                if !read_face_record(data, &mut pos, element, little, face_indices, face_sizes) {
                    return Ok(());
                }
            }
        } else {
            // An element the viewer has no use for still has to be stepped
            // over, or every element after it is read from the wrong offset.
            for _ in 0..element.count {
                values.clear();
                if !read_record_sequential(data, &mut pos, element, little, &mut values) {
                    return Ok(());
                }
            }
        }
    }
    Ok(())
}

/// Walks one record property by property. Returns false when the buffer ends.
fn read_record_sequential(
    data: &[u8],
    pos: &mut usize,
    element: &Element,
    little: bool,
    values: &mut Vec<f64>,
) -> bool {
    for property in &element.properties {
        match property {
            Property::Scalar { ty, .. } => {
                if *pos + ty.size() > data.len() {
                    return false;
                }
                values.push(read_scalar(data, *pos, *ty, little));
                *pos += ty.size();
            }
            Property::List {
                count_ty, index_ty, ..
            } => {
                if *pos + count_ty.size() > data.len() {
                    return false;
                }
                let n = read_scalar(data, *pos, *count_ty, little).max(0.0) as usize;
                *pos += count_ty.size();
                let bytes = n * index_ty.size();
                if *pos + bytes > data.len() {
                    return false;
                }
                *pos += bytes;
                // The list itself has no vertex target; only its length was
                // needed to stay aligned.
                values.push(n as f64);
            }
        }
    }
    true
}

fn read_face_record(
    data: &[u8],
    pos: &mut usize,
    element: &Element,
    little: bool,
    face_indices: &mut Vec<u32>,
    face_sizes: &mut Vec<u32>,
) -> bool {
    for property in &element.properties {
        match property {
            Property::Scalar { ty, .. } => {
                if *pos + ty.size() > data.len() {
                    return false;
                }
                *pos += ty.size();
            }
            Property::List {
                name,
                count_ty,
                index_ty,
            } => {
                if *pos + count_ty.size() > data.len() {
                    return false;
                }
                let n = read_scalar(data, *pos, *count_ty, little).max(0.0) as usize;
                *pos += count_ty.size();
                if *pos + n * index_ty.size() > data.len() {
                    return false;
                }
                let is_vertex_list = name == "vertex_indices" || name == "vertex_index";
                if is_vertex_list && n >= 3 {
                    face_sizes.push(n as u32);
                    for _ in 0..n {
                        face_indices.push(read_scalar(data, *pos, *index_ty, little) as u32);
                        *pos += index_ty.size();
                    }
                } else {
                    *pos += n * index_ty.size();
                }
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ascii_cube() -> Vec<u8> {
        b"ply\nformat ascii 1.0\ncomment made by a test\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0 255 0 0\n1 0 0 0 255 0\n0 1 0 0 0 255\n3 0 1 2\n".to_vec()
    }

    #[test]
    fn ascii_ply_reads_vertices_colours_and_faces() {
        let result = parse_ply_inner(&ascii_cube()).unwrap();
        assert_eq!(result.vertex_count, 3);
        assert_eq!(result.face_count, 1);
        assert_eq!(
            result.positions,
            vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
        );
        assert_eq!(result.colors, vec![255, 0, 0, 0, 255, 0, 0, 0, 255]);
        assert_eq!(result.face_sizes, vec![3]);
        assert_eq!(result.face_indices, vec![0, 1, 2]);
        assert!(result.metadata.contains("made by a test"));
    }

    /// The same content in binary must produce the same numbers — the two
    /// encodings had separate loops in the parser this replaces.
    #[test]
    fn binary_ply_agrees_with_ascii() {
        let mut binary = b"ply\nformat binary_little_endian 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n".to_vec();
        for (x, y, z, r, g, b) in [
            (0f32, 0f32, 0f32, 255u8, 0u8, 0u8),
            (1.0, 0.0, 0.0, 0, 255, 0),
            (0.0, 1.0, 0.0, 0, 0, 255),
        ] {
            binary.extend_from_slice(&x.to_le_bytes());
            binary.extend_from_slice(&y.to_le_bytes());
            binary.extend_from_slice(&z.to_le_bytes());
            binary.extend_from_slice(&[r, g, b]);
        }
        binary.push(3);
        for index in [0i32, 1, 2] {
            binary.extend_from_slice(&index.to_le_bytes());
        }

        let from_binary = parse_ply_inner(&binary).unwrap();
        let from_ascii = parse_ply_inner(&ascii_cube()).unwrap();
        assert_eq!(from_binary.positions, from_ascii.positions);
        assert_eq!(from_binary.colors, from_ascii.colors);
        assert_eq!(from_binary.face_indices, from_ascii.face_indices);
        assert_eq!(from_binary.face_sizes, from_ascii.face_sizes);
    }

    /// Big-endian files are rare but legal, and reading them as little-endian
    /// produces plausible-looking nonsense rather than an error.
    #[test]
    fn binary_big_endian_is_read_with_the_declared_byte_order() {
        let mut data = b"ply\nformat binary_big_endian 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n".to_vec();
        for v in [1.5f32, -2.5, 3.5] {
            data.extend_from_slice(&v.to_be_bytes());
        }
        let result = parse_ply_inner(&data).unwrap();
        assert_eq!(result.positions, vec![1.5, -2.5, 3.5]);
    }

    /// Non-standard numeric properties become named scalar fields, which is
    /// what the colour UI offers as scalar modes.
    #[test]
    fn extra_properties_become_scalar_fields() {
        let data = b"ply\nformat ascii 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nproperty float quality\nproperty float intensity\nend_header\n0 0 0 0.5 10\n1 1 1 1.5 20\n".to_vec();
        let mut result = parse_ply_inner(&data).unwrap();
        assert!(result.has_intensity);
        assert_eq!(result.intensity, vec![10.0, 20.0]);
        assert_eq!(result.scalar_names, vec!["quality".to_string()]);
        assert_eq!(result.take_scalar_at(0), vec![0.5, 1.5]);
    }

    /// A 3DGS file has no red/green/blue: colour is the SH DC term, and the
    /// spherical-harmonic and rotation properties must not become scalars.
    #[test]
    fn gaussian_splat_colours_come_from_the_dc_term() {
        let mut data = b"ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nproperty float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\nproperty float f_rest_0\nproperty float rot_0\nproperty float opacity\nproperty float nx\nproperty float ny\nproperty float nz\nend_header\n".to_vec();
        data.extend_from_slice(b"0 0 0 0 1.7724539 -1.7724539 0.1 0.2 0.9 0 0 0\n");
        let result = parse_ply_inner(&data).unwrap();

        assert!(result.is_gaussian_splat);
        assert!(result.has_colors);
        // 0 -> mid grey; +/-1.7724539 is exactly +/-0.5 after the SH constant.
        assert_eq!(result.colors, vec![128, 255, 0]);
        // 3DGS writes zero normals, so no normals array is produced.
        assert!(!result.has_normals);
        // opacity is a useful scalar; f_rest_* and rot_* are not.
        assert_eq!(result.scalar_names, vec!["opacity".to_string()]);
    }

    /// An element between vertex and face still occupies bytes; skipping it by
    /// its declared size is what keeps the faces aligned.
    #[test]
    fn unknown_elements_are_stepped_over() {
        let mut data = b"ply\nformat binary_little_endian 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nelement edge 2\nproperty int a\nproperty int b\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n".to_vec();
        for v in [7.0f32, 8.0, 9.0] {
            data.extend_from_slice(&v.to_le_bytes());
        }
        for v in [0i32, 1, 1, 2] {
            data.extend_from_slice(&v.to_le_bytes());
        }
        data.push(3);
        for index in [0i32, 1, 2] {
            data.extend_from_slice(&index.to_le_bytes());
        }

        let result = parse_ply_inner(&data).unwrap();
        assert_eq!(result.positions, vec![7.0, 8.0, 9.0]);
        assert_eq!(result.face_indices, vec![0, 1, 2]);
    }

    /// Float colour channels use the 0..1 convention; byte channels are 0..255.
    #[test]
    fn float_colour_channels_are_scaled() {
        let data = b"ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nproperty float red\nproperty float green\nproperty float blue\nend_header\n0 0 0 1 0.5 0\n".to_vec();
        let result = parse_ply_inner(&data).unwrap();
        assert_eq!(result.colors, vec![255, 128, 0]);
    }

    /// A truncated file yields the vertices that are actually there rather than
    /// zero-filled ones or a panic.
    #[test]
    fn a_truncated_binary_body_keeps_what_it_read() {
        let mut data = b"ply\nformat binary_little_endian 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n".to_vec();
        for v in [1.0f32, 2.0, 3.0, 4.0, 5.0, 6.0] {
            data.extend_from_slice(&v.to_le_bytes());
        }
        let result = parse_ply_inner(&data).unwrap();
        assert_eq!(result.vertex_count, 2);
        assert_eq!(result.positions, vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    }
}
