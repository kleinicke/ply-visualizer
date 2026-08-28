//! Leica LIF (Leica Image File) decoder.
//!
//! A LIF is an XML header block followed by a flat run of named memory blocks.
//! Every block is introduced by the same frame: a `u32` test code `0x70`, a
//! `u32` length, a `u8` marker `0x2A`, then the block's own payload
//! description. The header block's payload is a UTF-16LE XML document; a
//! memory block's is its byte size, a second `0x2A` marker, and a UTF-16LE
//! name.
//!
//! The XML describes a tree of `Element` nodes. A node with a `Data/Image`
//! child is an image series, and its `Memory/MemoryBlockID` names the block
//! holding that series' pixels. One file routinely holds many series of
//! different shapes — the reference file used while writing this has fifteen,
//! spanning plain 2D frames, Z stacks, mosaics and a stitched mosaic result.
//!
//! Pixel addressing is entirely stride-driven and does NOT assume any
//! particular axis order. Each `ChannelDescription` carries a `BytesInc` that
//! is the byte offset of that channel's plane inside the block, and each
//! `DimensionDescription` carries a `BytesInc` that is the stride along that
//! dimension. A sample's address is the channel offset plus the sum of
//! `coordinate * stride` over every dimension, which is what makes both the
//! planar layouts (channel offset ~ a whole plane) and any interleaved layout
//! (channel offset ~ one sample) fall out of the same arithmetic.
//!
//! `.lifext` sidecars are deliberately ignored: they hold derived data
//! (histograms and similar), keyed to the base file's block IDs, and carry no
//! pixels the viewer needs.

use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{f16_to_f32, get_slice, ScientificParsed};
use crate::DecodeError;
use std::collections::HashMap;

const TEST_CODE: u32 = 0x70;
const MARKER: u8 = 0x2A;

fn u32_le(data: &[u8], offset: usize) -> Result<u32, DecodeError> {
    let bytes = get_slice(data, offset, 4, "LIF")?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn u64_le(data: &[u8], offset: usize) -> Result<u64, DecodeError> {
    let bytes = get_slice(data, offset, 8, "LIF")?;
    Ok(u64::from_le_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    ]))
}

fn add(a: usize, b: usize) -> Result<usize, DecodeError> {
    a.checked_add(b)
        .ok_or_else(|| DecodeError::new("LIF offset arithmetic overflowed"))
}

fn mul(a: usize, b: usize) -> Result<usize, DecodeError> {
    a.checked_mul(b)
        .ok_or_else(|| DecodeError::new("LIF size arithmetic overflowed"))
}

fn u64_to_usize(value: u64, what: &str) -> Result<usize, DecodeError> {
    usize::try_from(value).map_err(|_| DecodeError::new(&format!("LIF {} is too large", what)))
}

/// Read `units` UTF-16LE code units as a `String`.
fn utf16_at(data: &[u8], offset: usize, units: usize) -> Result<String, DecodeError> {
    let bytes = get_slice(data, offset, mul(units, 2)?, "LIF name")?;
    let code_units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
        .collect();
    Ok(String::from_utf16_lossy(&code_units))
}

// ---------------------------------------------------------------------------
// Minimal XML tree
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct Node {
    name: String,
    attributes: Vec<(String, String)>,
    children: Vec<Node>,
}

impl Node {
    fn attribute(&self, key: &str) -> Option<&str> {
        self.attributes
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(key))
            .map(|(_, v)| v.as_str())
    }

    fn number(&self, key: &str) -> Option<f64> {
        self.attribute(key).and_then(|v| v.trim().parse::<f64>().ok())
    }

    fn child(&self, name: &str) -> Option<&Node> {
        self.children.iter().find(|c| c.name.eq_ignore_ascii_case(name))
    }

    /// Follow a chain of single child names.
    fn path(&self, names: &[&str]) -> Option<&Node> {
        let mut node = self;
        for name in names {
            node = node.child(name)?;
        }
        Some(node)
    }

    fn children_named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Node> {
        self.children
            .iter()
            .filter(move |c| c.name.eq_ignore_ascii_case(name))
    }
}

fn unescape_xml(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

/// Parse a tag's attribute list (`a="1" b="2"`).
fn parse_attributes(body: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let bytes = body.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        while i < bytes.len() && (bytes[i] as char).is_whitespace() {
            i += 1;
        }
        let start = i;
        while i < bytes.len() && bytes[i] != b'=' && !(bytes[i] as char).is_whitespace() {
            i += 1;
        }
        if start == i {
            break;
        }
        let key = body[start..i].to_string();
        while i < bytes.len() && (bytes[i] as char).is_whitespace() {
            i += 1;
        }
        if i >= bytes.len() || bytes[i] != b'=' {
            continue;
        }
        i += 1;
        while i < bytes.len() && (bytes[i] as char).is_whitespace() {
            i += 1;
        }
        if i >= bytes.len() || (bytes[i] != b'"' && bytes[i] != b'\'') {
            continue;
        }
        let quote = bytes[i];
        i += 1;
        let value_start = i;
        while i < bytes.len() && bytes[i] != quote {
            i += 1;
        }
        let value = unescape_xml(&body[value_start..i.min(body.len())]);
        out.push((key, value));
        i += 1;
    }
    out
}

/// Recursive-descent XML reader, tolerant enough for the Leica header and
/// deliberately ignorant of text content (the LIF header carries data only in
/// attributes).
fn parse_xml(text: &str) -> Option<Node> {
    let bytes = text.as_bytes();
    let mut cursor = 0usize;
    let mut stack: Vec<Node> = Vec::new();
    let mut root: Option<Node> = None;
    while cursor < bytes.len() {
        let Some(open_rel) = bytes[cursor..].iter().position(|&b| b == b'<') else {
            break;
        };
        let open = cursor + open_rel;
        let Some(close_rel) = bytes[open..].iter().position(|&b| b == b'>') else {
            break;
        };
        let close = open + close_rel;
        let tag = &text[open + 1..close];
        cursor = close + 1;
        if tag.starts_with('?') || tag.starts_with('!') {
            continue;
        }
        if let Some(name) = tag.strip_prefix('/') {
            let name = name.trim();
            // Close the innermost matching element.
            if let Some(done) = stack.pop() {
                if !done.name.eq_ignore_ascii_case(name) {
                    // Mismatched close: keep the element anyway rather than
                    // discarding a whole subtree over one bad tag.
                }
                match stack.last_mut() {
                    Some(parent) => parent.children.push(done),
                    None => root = Some(done),
                }
            }
            continue;
        }
        let self_closing = tag.ends_with('/');
        let body = tag.trim_end_matches('/');
        let name_end = body
            .find(|c: char| c.is_whitespace())
            .unwrap_or(body.len());
        let name = body[..name_end].to_string();
        let attributes = parse_attributes(&body[name_end..]);
        let node = Node {
            name,
            attributes,
            children: Vec::new(),
        };
        if self_closing {
            match stack.last_mut() {
                Some(parent) => parent.children.push(node),
                None => root = Some(node),
            }
        } else {
            stack.push(node);
        }
    }
    // Unwind anything left open by a truncated document.
    while let Some(done) = stack.pop() {
        match stack.last_mut() {
            Some(parent) => parent.children.push(done),
            None => root = Some(done),
        }
    }
    root
}

// ---------------------------------------------------------------------------
// Series model
// ---------------------------------------------------------------------------

/// Leica dimension identifiers, as written in `DimensionDescription/DimID`.
fn dimension_name(id: i64) -> &'static str {
    match id {
        1 => "X",
        2 => "Y",
        3 => "Z",
        4 => "T",
        5 => "L",
        6 => "R",
        7 => "XT",
        8 => "TS",
        10 => "M",
        _ => "?",
    }
}

struct Dimension {
    name: &'static str,
    size: usize,
    bytes_inc: usize,
}

struct Channel {
    bytes_inc: usize,
    resolution: u32,
    /// Leica `DataType`: 0 = integer, 1 = floating point. Ignoring it makes a
    /// 32-bit integer channel decode as garbage floats (and vice versa), so it
    /// selects the sample interpretation rather than the width alone.
    data_type: i64,
    tag: i64,
    name: Option<String>,
}

struct Series {
    name: String,
    dimensions: Vec<Dimension>,
    channels: Vec<Channel>,
    memory_block: String,
    /// Micrometres per pixel along X, when the header records a real length.
    scaling_x_um: Option<f64>,
    scaling_y_um: Option<f64>,
}

/// Walk the `Element` tree, collecting every node that carries image data.
fn collect_series(node: &Node, prefix: &str, out: &mut Vec<Series>) {
    for element in node.children_named("Element") {
        let name = element.attribute("Name").unwrap_or_default().to_string();
        let path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", prefix, name)
        };
        if let Some(image) = element.path(&["Data", "Image"]) {
            if let Some(series) = build_series(element, image, &path) {
                out.push(series);
            }
        }
        if let Some(children) = element.child("Children") {
            collect_series(children, &path, out);
        }
    }
}

fn build_series(element: &Node, image: &Node, path: &str) -> Option<Series> {
    let description = image.child("ImageDescription")?;
    let memory_block = element.child("Memory")?.attribute("MemoryBlockID")?.to_string();

    let mut dimensions = Vec::new();
    if let Some(dims) = description.child("Dimensions") {
        for dim in dims.children_named("DimensionDescription") {
            let id = dim.number("DimID").unwrap_or(-1.0) as i64;
            let size = dim.number("NumberOfElements").unwrap_or(0.0) as i64;
            let bytes_inc = dim.number("BytesInc").unwrap_or(0.0);
            if size <= 0 || !bytes_inc.is_finite() || bytes_inc < 0.0 {
                continue;
            }
            dimensions.push(Dimension {
                name: dimension_name(id),
                size: size as usize,
                bytes_inc: bytes_inc as usize,
            });
        }
    }
    let mut channels = Vec::new();
    if let Some(chans) = description.child("Channels") {
        for channel in chans.children_named("ChannelDescription") {
            let bytes_inc = channel.number("BytesInc").unwrap_or(0.0);
            channels.push(Channel {
                bytes_inc: if bytes_inc.is_finite() && bytes_inc >= 0.0 {
                    bytes_inc as usize
                } else {
                    0
                },
                resolution: channel.number("Resolution").unwrap_or(8.0) as u32,
                data_type: channel.number("DataType").unwrap_or(0.0) as i64,
                tag: channel.number("ChannelTag").unwrap_or(0.0) as i64,
                name: channel
                    .attribute("LUTName")
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string()),
            });
        }
    }
    if dimensions.is_empty() || channels.is_empty() {
        return None;
    }

    // `Length` is the physical extent in metres over `NumberOfElements - 1`
    // steps; report micrometres per pixel, the working unit in this viewer.
    let physical = |axis: &str| -> Option<f64> {
        let dims = description.child("Dimensions")?;
        for dim in dims.children_named("DimensionDescription") {
            let id = dim.number("DimID").unwrap_or(-1.0) as i64;
            if dimension_name(id) != axis {
                continue;
            }
            let count = dim.number("NumberOfElements").unwrap_or(0.0);
            let length = dim.number("Length").unwrap_or(f64::NAN);
            if count > 1.0 && length.is_finite() && length > 0.0 {
                return Some(length / (count - 1.0) * 1e6);
            }
        }
        None
    };

    Some(Series {
        name: path.to_string(),
        dimensions,
        channels,
        memory_block,
        scaling_x_um: physical("X"),
        scaling_y_um: physical("Y"),
    })
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

struct DecodeOptions {
    indices: HashMap<String, f64>,
    series: Option<usize>,
}

fn parse_options(options_json: &str) -> DecodeOptions {
    let mut out = DecodeOptions {
        indices: HashMap::new(),
        series: None,
    };
    if options_json.trim().is_empty() {
        return out;
    }
    let Ok(root) = super::json_value::parse(options_json) else {
        return out;
    };
    if let Some(indices) = root.get("indices").and_then(|v| v.as_obj()) {
        for (key, value) in indices {
            if let Some(number) = value.as_num() {
                out.indices.insert(key.clone(), number);
            }
        }
    }
    if let Some(series) = root.get("series").and_then(|v| v.as_num()) {
        if series.is_finite() && series >= 0.0 {
            out.series = Some(series as usize);
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Main decode
// ---------------------------------------------------------------------------

pub(crate) fn decode_lif_impl(
    data: &[u8],
    options_json: &str,
) -> Result<ScientificParsed, DecodeError> {
    if data.len() < 16 || u32_le(data, 0)? != TEST_CODE {
        return Err(DecodeError::new("Invalid LIF signature"));
    }
    if *get_slice(data, 8, 1, "LIF header")?.first().unwrap_or(&0) != MARKER {
        return Err(DecodeError::new("LIF header is missing its 0x2A marker"));
    }
    let xml_units = u64_to_usize(u32_le(data, 9)? as u64, "header length")?;
    let xml_text = utf16_at(data, 13, xml_units)?;
    let root = parse_xml(&xml_text).ok_or_else(|| DecodeError::new("LIF header XML is unreadable"))?;

    // The container version decides the width of every memory block's size
    // field: version 1 wrote a u32, version 2 a u64. Guessing wrong desynchronises
    // the whole block chain, so it is read from the header rather than sniffed.
    let version = root.number("Version").unwrap_or(2.0) as i64;

    let mut blocks: HashMap<String, (usize, usize)> = HashMap::new();
    let mut cursor = add(13, mul(xml_units, 2)?)?;
    while cursor + 13 < data.len() {
        if u32_le(data, cursor)? != TEST_CODE {
            break;
        }
        // [u32 testcode][u32 length][u8 0x2A][size][u8 0x2A][u32 name_units][name]
        let mut offset = add(cursor, 8)?;
        if *get_slice(data, offset, 1, "LIF block")?.first().unwrap_or(&0) != MARKER {
            break;
        }
        offset = add(offset, 1)?;
        let size = if version >= 2 {
            let value = u64_to_usize(u64_le(data, offset)?, "block size")?;
            offset = add(offset, 8)?;
            value
        } else {
            let value = u64_to_usize(u32_le(data, offset)? as u64, "block size")?;
            offset = add(offset, 4)?;
            value
        };
        if *get_slice(data, offset, 1, "LIF block")?.first().unwrap_or(&0) != MARKER {
            break;
        }
        offset = add(offset, 1)?;
        let name_units = u64_to_usize(u32_le(data, offset)? as u64, "block name length")?;
        offset = add(offset, 4)?;
        let name = utf16_at(data, offset, name_units)?;
        offset = add(offset, mul(name_units, 2)?)?;
        blocks.insert(name, (offset, size));
        cursor = add(offset, size)?;
    }

    let mut series_list: Vec<Series> = Vec::new();
    if let Some(element) = root.child("Element") {
        // The outermost Element is the file itself; its children are the series.
        let name = element.attribute("Name").unwrap_or_default().to_string();
        if let Some(image) = element.path(&["Data", "Image"]) {
            if let Some(series) = build_series(element, image, &name) {
                series_list.push(series);
            }
        }
        if let Some(children) = element.child("Children") {
            collect_series(children, "", &mut series_list);
        }
    }
    // Only series whose pixels are actually in this file are offered.
    series_list.retain(|series| blocks.contains_key(&series.memory_block));
    if series_list.is_empty() {
        return Err(DecodeError::new(
            "LIF file contains no image series with pixel data",
        ));
    }

    let options = parse_options(options_json);
    let series_count = series_list.len();
    let series_index = options
        .indices
        .get("S")
        .copied()
        .filter(|v| v.is_finite())
        .map(|v| v.round() as i64)
        .or(options.series.map(|v| v as i64))
        .unwrap_or(0)
        .max(0)
        .min(series_count as i64 - 1) as usize;
    let series = &series_list[series_index];

    // --- Geometry --------------------------------------------------------
    let width_dim = series
        .dimensions
        .iter()
        .find(|d| d.name == "X")
        .ok_or_else(|| DecodeError::new("LIF series has no X dimension"))?;
    let height_dim = series
        .dimensions
        .iter()
        .find(|d| d.name == "Y")
        .ok_or_else(|| DecodeError::new("LIF series has no Y dimension"))?;
    let width = width_dim.size;
    let height = height_dim.size;
    if width == 0 || height == 0 {
        return Err(DecodeError::new("LIF series has an empty extent"));
    }

    let resolution = series.channels[0].resolution.max(1);
    if series
        .channels
        .iter()
        .any(|c| c.resolution != series.channels[0].resolution)
    {
        return Err(DecodeError::new(
            "Mixed channel bit depths in one LIF series are not supported",
        ));
    }
    // Leica records significant bits (12-bit cameras are common); the stored
    // sample is the next whole number of bytes up.
    let bytes_per_sample = ((resolution as usize) + 7) / 8;
    let is_float = series.channels[0].data_type == 1;
    if series
        .channels
        .iter()
        .any(|c| c.data_type != series.channels[0].data_type)
    {
        return Err(DecodeError::new(
            "Mixed integer and float channels in one LIF series are not supported",
        ));
    }
    let (sample_format, type_max, source_numeric_type, bits_per_sample) =
        match (is_float, bytes_per_sample) {
            (false, 1) => (1u32, 255.0f64, "uint8", 8u32),
            (false, 2) => (1, 65535.0, "uint16", 16),
            (false, 4) => (1, 4294967295.0, "uint32", 32),
            (true, 2) => (3, 1.0, "float16", 16),
            (true, 4) => (3, 1.0, "float32", 32),
            _ => {
                return Err(DecodeError::new(&format!(
                    "Unsupported LIF channel format: {} bits, DataType {}",
                    resolution, series.channels[0].data_type
                )))
            }
        };

    // A three-channel series tagged red/green/blue is a colour image; anything
    // else is independent measurements, presented one channel at a time so the
    // pixel inspector reports real values.
    let is_rgb = series.channels.len() == 3
        && series.channels.iter().map(|c| c.tag).collect::<Vec<_>>() == vec![1, 2, 3];
    let output_channels = if is_rgb { 3 } else { 1 };
    let channel_count = series.channels.len();
    let requested_channel = options
        .indices
        .get("C")
        .copied()
        .filter(|v| v.is_finite())
        .map(|v| v.round() as i64)
        .unwrap_or(0)
        .max(0)
        .min(channel_count as i64 - 1) as usize;

    // --- Plane axes ------------------------------------------------------
    // Everything that is not X or Y is navigable.
    let plane_axes: Vec<&Dimension> = series
        .dimensions
        .iter()
        .filter(|d| d.name != "X" && d.name != "Y" && d.size > 1)
        .collect();
    let mut plane_offset = 0usize;
    let mut selected: Vec<usize> = Vec::new();
    for axis in &plane_axes {
        let requested = options
            .indices
            .get(axis.name)
            .copied()
            .filter(|v| v.is_finite())
            .map(|v| v.round() as i64)
            .unwrap_or(0)
            .max(0)
            .min(axis.size as i64 - 1) as usize;
        selected.push(requested);
        plane_offset = add(plane_offset, mul(requested, axis.bytes_inc)?)?;
    }

    let (block_offset, block_size) = *blocks
        .get(&series.memory_block)
        .ok_or_else(|| DecodeError::new("LIF series references a missing memory block"))?;
    let block = get_slice(data, block_offset, block_size, "LIF memory block")?;

    // --- Assemble --------------------------------------------------------
    let mut out = vec![0f32; mul(mul(width, height)?, output_channels)?];
    let row_stride = height_dim.bytes_inc;
    let column_stride = width_dim.bytes_inc;
    for row in 0..height {
        let row_base = add(plane_offset, mul(row, row_stride)?)?;
        let target_row = mul(mul(row, width)?, output_channels)?;
        for column in 0..width {
            let base = add(row_base, mul(column, column_stride)?)?;
            if is_rgb {
                for channel in 0..3 {
                    let offset = add(base, series.channels[channel].bytes_inc)?;
                    out[target_row + column * 3 + channel] =
                        read_sample(block, offset, bytes_per_sample, is_float)?;
                }
            } else {
                let offset = add(base, series.channels[requested_channel].bytes_inc)?;
                out[target_row + column] = read_sample(block, offset, bytes_per_sample, is_float)?;
            }
        }
    }

    // --- Metadata --------------------------------------------------------
    // Only names the FILE supplied. A synthesized "Channel 3" is not a name —
    // it says nothing a "3 / 4" slider reading does not — and emitting one
    // makes an unnamed channel look named to every consumer downstream.
    let channel_names: Vec<String> = series
        .channels
        .iter()
        .filter_map(|channel| channel.name.clone())
        .collect();
    let channel_names = if channel_names.len() == series.channels.len() {
        channel_names
    } else {
        Vec::new()
    };

    // A selector carries optional per-option LABELS. A selector that has them
    // is a choice among named, differently-shaped things and the UI renders it
    // as a dropdown; one without them is a homogeneous axis and stays a slider.
    // Nothing here decides which widget appears — the presence of names does.
    let mut selectors: Vec<(String, usize, usize, Option<Vec<String>>)> = Vec::new();
    if series_count > 1 {
        selectors.push((
            "S".to_string(),
            series_count,
            series_index,
            // The series names are what make this a dropdown rather than a
            // scrub: "Region 2_Merged" is not the fifth step of anything.
            Some(series_list.iter().map(|item| item.name.clone()).collect()),
        ));
    }
    for (axis, value) in plane_axes.iter().zip(selected.iter()) {
        selectors.push((axis.name.to_string(), axis.size, *value, None));
    }
    if channel_count > 1 && !is_rgb {
        // Same rule as every other selector and every other decoder: names
        // present => a choice, names absent => an axis.
        let labels = if channel_names.len() == channel_count {
            Some(channel_names.clone())
        } else {
            None
        };
        selectors.push(("C".to_string(), channel_count, requested_channel, labels));
    }

    let mut fields: Vec<(String, JsonValue)> = Vec::new();
    fields.push(("format".to_string(), JsonValue::Str("LIF".to_string())));
    fields.push((
        "pixelTypeName".to_string(),
        JsonValue::Str(source_numeric_type.to_string()),
    ));
    fields.push((
        "seriesName".to_string(),
        JsonValue::Str(series.name.clone()),
    ));
    fields.push((
        "seriesCount".to_string(),
        JsonValue::Num(series_count as f64),
    ));
    if resolution % 8 != 0 {
        // A 12-bit camera stored in 16-bit words: worth surfacing, because it
        // explains why the data never reaches the type maximum.
        fields.push((
            "significantBits".to_string(),
            JsonValue::Num(resolution as f64),
        ));
    }
    push_opt(
        &mut fields,
        "scalingXUm",
        series.scaling_x_um.map(JsonValue::Num),
    );
    push_opt(
        &mut fields,
        "scalingYUm",
        series.scaling_y_um.map(JsonValue::Num),
    );
    if !channel_names.is_empty() {
        fields.push((
            "channelNames".to_string(),
            JsonValue::Arr(channel_names.iter().map(|n| JsonValue::Str(n.clone())).collect()),
        ));
    }
    fields.push((
        "selectors".to_string(),
        JsonValue::Arr(
            selectors
                .iter()
                .map(|(name, size, value, labels)| {
                    let mut fields = vec![
                        ("name".to_string(), JsonValue::Str(name.clone())),
                        ("size".to_string(), JsonValue::Num(*size as f64)),
                        ("value".to_string(), JsonValue::Num(*value as f64)),
                    ];
                    if let Some(labels) = labels {
                        fields.push((
                            "labels".to_string(),
                            JsonValue::Arr(
                                labels.iter().map(|l| JsonValue::Str(l.clone())).collect(),
                            ),
                        ));
                    }
                    JsonValue::Obj(fields)
                })
                .collect(),
        ),
    ));
    fields.push((
        "selectedIndices".to_string(),
        JsonValue::Obj(
            selectors
                .iter()
                .map(|(name, _, value, _)| (name.clone(), JsonValue::Num(*value as f64)))
                .collect(),
        ),
    ));
    let metadata_json = to_json_string(&JsonValue::Obj(fields));

    Ok(ScientificParsed {
        width: width as u32,
        height: height as u32,
        channels: output_channels as u32,
        bits_per_sample,
        sample_format,
        type_min: 0.0,
        type_max,
        source_numeric_type: source_numeric_type.to_string(),
        metadata_json,
        data: out,
    })
}

fn read_sample(
    block: &[u8],
    offset: usize,
    bytes: usize,
    is_float: bool,
) -> Result<f32, DecodeError> {
    let slice = get_slice(block, offset, bytes, "LIF pixel")?;
    Ok(match (bytes, is_float) {
        (1, _) => slice[0] as f32,
        (2, false) => u16::from_le_bytes([slice[0], slice[1]]) as f32,
        (2, true) => f16_to_f32(u16::from_le_bytes([slice[0], slice[1]])),
        (4, true) => f32::from_bits(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]])),
        (4, false) => u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]) as f32,
        _ => return Err(DecodeError::new("Unsupported LIF sample width")),
    })
}


