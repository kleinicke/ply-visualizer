//! Zeiss CZI (ZISRAW) decoder.
//!
//! Bit-exact port of `parseCzi` and its helpers (`cziSegment`,
//! `cziDirectoryEntry`, `cziSubBlockEntries`, `cziXmlMetadata`,
//! `CZI_PIXEL_TYPES`, `CZI_COMPRESSION_NAMES`, `CZI_AXIS_ORDER`) that used to
//! live in `media/modules/scientific-format-parsers.ts` (now deleted — this
//! is the only implementation left).
//!
//! CZI stores each plane (and each mosaic tile) as an independent subblock
//! keyed by dimension coordinates; decoding means walking the subblock
//! directory (falling back to a full segment scan when the directory is
//! missing or corrupt), picking the subblocks matching the requested
//! Z/C/T/... coordinate, and blitting them into one raster. Only uncompressed
//! subblocks are handled; compressed variants (JPEG/LZW/JPEG XR/Zstd) report
//! which codec the file needs rather than being decoded. Pyramid (subsampled)
//! subblocks are skipped so the full-resolution plane is always what gets
//! assembled.
//!
//! `options_json` carries the small `CziDecodeOptions` shape
//! (`{ indices?: Record<string, number> }`) as JSON, parsed with the tiny
//! reader in `json_value.rs`.
//!
//! One behavioral fix over the deleted TS: `CZI_PIXEL_TYPES[13]` (Gray64,
//! true 64-bit float) reported `bitsPerSample: 32` — a copy-paste artifact
//! from the float32 pixel types (Gray32Float/Bgr96Float). This port reports
//! `bitsPerSample: 64` for Gray64, which is what the format actually stores.
//!
//! Held equal to the frozen goldens by `test/rust-scientific-conformance-test.js`.

use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{ascii, get_slice, js_number, ScientificParsed};
use crate::DecodeError;
use std::collections::HashMap;

/// Axis order used for the plane selector UI; unknown axes are appended.
const CZI_AXIS_ORDER: [&str; 10] = ["S", "I", "V", "H", "R", "T", "C", "Z", "B", "M"];

fn compression_name(id: i32) -> String {
    match id {
        1 => "JPEG".to_string(),
        2 => "LZW".to_string(),
        4 => "JPEG XR".to_string(),
        5 => "Zstd-0".to_string(),
        6 => "Zstd-1".to_string(),
        other => format!("id {}", other),
    }
}

// ---------------------------------------------------------------------------
// Pixel type table
// ---------------------------------------------------------------------------

struct PixelTypeInfo {
    name: &'static str,
    channels: u32,
    bgr: bool,
    bytes_per_channel: u32,
    bits_per_sample: u32,
    sample_format: u32,
    type_min: f64,
    type_max: f64,
    source_numeric_type: &'static str,
}

fn pixel_type_info(id: i32) -> Option<PixelTypeInfo> {
    match id {
        0 => Some(PixelTypeInfo {
            name: "Gray8",
            channels: 1,
            bgr: false,
            bytes_per_channel: 1,
            bits_per_sample: 8,
            sample_format: 1,
            type_min: 0.0,
            type_max: 255.0,
            source_numeric_type: "uint8",
        }),
        1 => Some(PixelTypeInfo {
            name: "Gray16",
            channels: 1,
            bgr: false,
            bytes_per_channel: 2,
            bits_per_sample: 16,
            sample_format: 1,
            type_min: 0.0,
            type_max: 65535.0,
            source_numeric_type: "uint16",
        }),
        2 => Some(PixelTypeInfo {
            name: "Gray32Float",
            channels: 1,
            bgr: false,
            bytes_per_channel: 4,
            bits_per_sample: 32,
            sample_format: 3,
            type_min: 0.0,
            type_max: 1.0,
            source_numeric_type: "float32",
        }),
        3 => Some(PixelTypeInfo {
            name: "Bgr24",
            channels: 3,
            bgr: true,
            bytes_per_channel: 1,
            bits_per_sample: 8,
            sample_format: 1,
            type_min: 0.0,
            type_max: 255.0,
            source_numeric_type: "uint8",
        }),
        4 => Some(PixelTypeInfo {
            name: "Bgr48",
            channels: 3,
            bgr: true,
            bytes_per_channel: 2,
            bits_per_sample: 16,
            sample_format: 1,
            type_min: 0.0,
            type_max: 65535.0,
            source_numeric_type: "uint16",
        }),
        8 => Some(PixelTypeInfo {
            name: "Bgr96Float",
            channels: 3,
            bgr: true,
            bytes_per_channel: 4,
            bits_per_sample: 32,
            sample_format: 3,
            type_min: 0.0,
            type_max: 1.0,
            source_numeric_type: "float32",
        }),
        9 => Some(PixelTypeInfo {
            name: "Bgra32",
            channels: 4,
            bgr: true,
            bytes_per_channel: 1,
            bits_per_sample: 8,
            sample_format: 1,
            type_min: 0.0,
            type_max: 255.0,
            source_numeric_type: "uint8",
        }),
        12 => Some(PixelTypeInfo {
            name: "Gray32",
            channels: 1,
            bgr: false,
            bytes_per_channel: 4,
            bits_per_sample: 32,
            sample_format: 2,
            type_min: -2147483648.0,
            type_max: 2147483647.0,
            source_numeric_type: "int32",
        }),
        // BUG FIX vs the deleted TS table: Gray64 is a true 64-bit float
        // sample (`getFloat64`), but the TS domain entry claimed
        // `bitsPerSample: 32` (copied from the float32 entries above it).
        // Reported as 64 here, matching what the format actually stores.
        13 => Some(PixelTypeInfo {
            name: "Gray64",
            channels: 1,
            bgr: false,
            bytes_per_channel: 8,
            bits_per_sample: 64,
            sample_format: 3,
            type_min: 0.0,
            type_max: 1.0,
            source_numeric_type: "float64",
        }),
        _ => None,
    }
}

/// Mirrors TS `pixelType.read(view, offset)`: reads one raw sample as f64,
/// little-endian, at `offset`. `pixel_type_id` must be one already validated
/// by [`pixel_type_info`].
fn read_sample(data: &[u8], pixel_type_id: i32, offset: usize) -> Result<f64, DecodeError> {
    match pixel_type_id {
        0 | 3 | 9 => {
            let b = get_slice(data, offset, 1, "CZI")?;
            Ok(b[0] as f64)
        }
        1 | 4 => {
            let b = get_slice(data, offset, 2, "CZI")?;
            Ok(u16::from_le_bytes([b[0], b[1]]) as f64)
        }
        2 | 8 => {
            let b = get_slice(data, offset, 4, "CZI")?;
            Ok(f32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f64)
        }
        12 => {
            let b = get_slice(data, offset, 4, "CZI")?;
            Ok(i32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f64)
        }
        13 => {
            let b = get_slice(data, offset, 8, "CZI")?;
            Ok(f64::from_le_bytes([
                b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
            ]))
        }
        other => Err(DecodeError::new(&format!(
            "Unsupported CZI pixel type: {}",
            other
        ))),
    }
}

// ---------------------------------------------------------------------------
// Low-level binary readers
// ---------------------------------------------------------------------------

fn add(a: usize, b: usize) -> Result<usize, DecodeError> {
    a.checked_add(b)
        .ok_or_else(|| DecodeError::new("CZI: offset overflow"))
}

fn mul(a: usize, b: usize) -> Result<usize, DecodeError> {
    a.checked_mul(b)
        .ok_or_else(|| DecodeError::new("CZI: size overflow"))
}

fn i32_le(data: &[u8], offset: usize) -> Result<i32, DecodeError> {
    let b = get_slice(data, offset, 4, "CZI")?;
    Ok(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn i64_le(data: &[u8], offset: usize) -> Result<i64, DecodeError> {
    let b = get_slice(data, offset, 8, "CZI")?;
    Ok(i64::from_le_bytes([
        b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
    ]))
}

/// `i64` file position/byte-count -> `usize`, rejecting negative or
/// unrepresentable (32-bit wasm `usize`) values instead of silently wrapping.
fn i64_to_usize(v: i64, context: &str) -> Result<usize, DecodeError> {
    usize::try_from(v).map_err(|_| DecodeError::new(&format!("CZI: {} out of range", context)))
}

struct Segment {
    id: String,
    data_start: usize,
    #[allow(dead_code)]
    used_size: i64,
}

/// Mirrors TS `cziSegment()`.
fn czi_segment(data: &[u8], position: i64) -> Result<Segment, DecodeError> {
    if position < 0 {
        return Err(DecodeError::new(&format!(
            "CZI segment out of range at {}",
            position
        )));
    }
    let pos = i64_to_usize(position, "segment position")?;
    let end = pos
        .checked_add(32)
        .ok_or_else(|| DecodeError::new("CZI: offset overflow"))?;
    if end > data.len() {
        return Err(DecodeError::new(&format!(
            "CZI segment out of range at {}",
            position
        )));
    }
    let id = ascii(data, pos, 16).trim_end_matches('\0').to_string();
    let used_size = i64_le(data, pos + 24)?;
    Ok(Segment {
        id,
        data_start: pos + 32,
        used_size,
    })
}

#[derive(Clone, Copy)]
struct CziDimension {
    start: i32,
    size: i32,
    stored_size: i32,
}

struct CziDirectoryEntry {
    pixel_type: i32,
    file_position: i64,
    compression: i32,
    /// Insertion-ordered, like the TS `Record<string, CziDimension>` (JS
    /// preserves string-key insertion order) — order matters for
    /// axis/selector ordering downstream.
    dimensions: Vec<(String, CziDimension)>,
    byte_length: usize,
}

fn find_dim<'a>(dims: &'a [(String, CziDimension)], name: &str) -> Option<&'a CziDimension> {
    dims.iter().find(|(n, _)| n == name).map(|(_, d)| d)
}

/// Mirrors TS `cziDirectoryEntry()`: 32 fixed bytes plus 20 bytes per
/// dimension entry.
fn czi_directory_entry(data: &[u8], offset: usize) -> Result<CziDirectoryEntry, DecodeError> {
    let dimension_count = i32_le(data, add(offset, 28)?)?;
    if !(0..=64).contains(&dimension_count) {
        return Err(DecodeError::new(&format!(
            "Invalid CZI dimension count: {}",
            dimension_count
        )));
    }
    let dimension_count = dimension_count as usize;
    let mut dimensions: Vec<(String, CziDimension)> = Vec::new();
    for i in 0..dimension_count {
        let entry = add(add(offset, 32)?, mul(i, 20)?)?;
        let name = ascii(data, entry, 4).replace('\0', "");
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        let start = i32_le(data, add(entry, 4)?)?;
        let size = i32_le(data, add(entry, 8)?)?;
        let stored_raw = i32_le(data, add(entry, 16)?)?;
        let stored_size = if stored_raw != 0 { stored_raw } else { size };
        let dim = CziDimension {
            start,
            size,
            stored_size,
        };
        if let Some(existing) = dimensions.iter_mut().find(|(n, _)| n == name) {
            existing.1 = dim;
        } else {
            dimensions.push((name.to_string(), dim));
        }
    }
    Ok(CziDirectoryEntry {
        pixel_type: i32_le(data, add(offset, 2)?)?,
        file_position: i64_le(data, add(offset, 6)?)?,
        compression: i32_le(data, add(offset, 18)?)?,
        dimensions,
        byte_length: 32 + dimension_count * 20,
    })
}

/// Read the subblock directory, falling back to a sequential segment scan.
/// Mirrors TS `cziSubBlockEntries()`.
fn czi_subblock_entries(
    data: &[u8],
    directory_position: i64,
) -> Result<Vec<CziDirectoryEntry>, DecodeError> {
    let mut entries: Vec<CziDirectoryEntry> = Vec::new();
    if directory_position > 0 && directory_position + 32 < data.len() as i64 {
        let segment = czi_segment(data, directory_position)?;
        if segment.id == "ZISRAWDIRECTORY" {
            let count = i32_le(data, segment.data_start)?;
            if count > 0 {
                let count = count as usize;
                // EntryCount (4 bytes) is followed by 124 reserved bytes.
                let mut offset = add(segment.data_start, 128)?;
                for _ in 0..count {
                    let entry = czi_directory_entry(data, offset)?;
                    offset = add(offset, entry.byte_length)?;
                    entries.push(entry);
                }
                if !entries.is_empty() {
                    return Ok(entries);
                }
            }
        }
    }
    // Fallback: walk every segment and pick up the subblocks directly.
    let mut position: i64 = 0;
    while position >= 0 && (position as i64) + 32 <= data.len() as i64 {
        let segment = czi_segment(data, position)?;
        if segment.id.is_empty() {
            break;
        }
        let pos_usize = i64_to_usize(position, "segment position")?;
        let allocated = i64_le(data, add(pos_usize, 16)?)?;
        if segment.id == "ZISRAWSUBBLOCK" {
            let mut entry = czi_directory_entry(data, add(segment.data_start, 16)?)?;
            entry.file_position = position;
            entries.push(entry);
        }
        if allocated <= 0 {
            break;
        }
        position = match (segment.data_start as i64).checked_add(allocated) {
            Some(p) => p,
            None => break,
        };
    }
    Ok(entries)
}

// ---------------------------------------------------------------------------
// XML metadata (hand-rolled, case-insensitive tag text extraction — no regex
// crate in this project; see Cargo.toml)
// ---------------------------------------------------------------------------

fn find_ci(haystack: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || from >= haystack.len() || haystack.len() < needle.len() {
        return None;
    }
    let last = haystack.len() - needle.len();
    let mut i = from;
    while i <= last {
        if haystack[i..i + needle.len()].eq_ignore_ascii_case(needle) {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// Mirrors the TS `text(tag)` closure: `xml.match(new RegExp("<" + tag +
/// "[^>]*>([^<]*)</" + tag + ">", "i"))`, trimmed. Requires the literal exact
/// closing tag (case-insensitive) to appear right where the captured text
/// ends; otherwise retries from the next possible opening-tag occurrence,
/// approximating regex backtracking closely enough for real CZI XML.
fn tag_text(xml: &str, tag: &str) -> Option<String> {
    let bytes = xml.as_bytes();
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let mut search_from = 0usize;
    loop {
        let open_pos = find_ci(bytes, open.as_bytes(), search_from)?;
        let gt_from = open_pos + open.len();
        let gt_pos = bytes
            .get(gt_from..)?
            .iter()
            .position(|&b| b == b'>')
            .map(|p| p + gt_from)?;
        let text_start = gt_pos + 1;
        let lt_pos = bytes[text_start..]
            .iter()
            .position(|&b| b == b'<')
            .map(|p| p + text_start)
            .unwrap_or(bytes.len());
        if lt_pos + close.len() <= bytes.len()
            && bytes[lt_pos..lt_pos + close.len()].eq_ignore_ascii_case(close.as_bytes())
        {
            return Some(
                String::from_utf8_lossy(&bytes[text_start..lt_pos])
                    .trim()
                    .to_string(),
            );
        }
        search_from = open_pos + 1;
    }
}

/// Mirrors the TS dye-name match: `block.match(/<(?:DyeName|Fluor|Name)[^>]*>([^<]*)</i)`
/// — no closing-tag verification, just "text up to the next `<`".
fn dye_name(block: &str) -> Option<String> {
    let bytes = block.as_bytes();
    let lower = block.to_ascii_lowercase();
    let lower_bytes = lower.as_bytes();
    let mut best: Option<usize> = None;
    for tag in ["<dyename", "<fluor", "<name"] {
        if let Some(pos) = find_ci(lower_bytes, tag.as_bytes(), 0) {
            best = Some(match best {
                Some(b) => b.min(pos),
                None => pos,
            });
        }
    }
    let start = best?;
    let gt_pos = bytes
        .get(start..)?
        .iter()
        .position(|&b| b == b'>')
        .map(|p| p + start)?;
    let text_start = gt_pos + 1;
    let lt_pos = bytes[text_start..]
        .iter()
        .position(|&b| b == b'<')
        .map(|p| p + text_start)
        .unwrap_or(bytes.len());
    Some(
        String::from_utf8_lossy(&bytes[text_start..lt_pos])
            .trim()
            .to_string(),
    )
}

/// Mirrors TS `xml.split(/<Channel[\s>]/i).slice(1)`: the blocks of XML
/// following each `<Channel` (followed by whitespace or `>`) occurrence.
fn channel_blocks(xml: &str) -> Vec<&str> {
    let bytes = xml.as_bytes();
    let lower = xml.to_ascii_lowercase();
    let lower_bytes = lower.as_bytes();
    let mut matches: Vec<(usize, usize)> = Vec::new(); // (match_start, match_end)
    let mut from = 0usize;
    while let Some(pos) = find_ci(lower_bytes, b"<channel", from) {
        let after = pos + 8;
        if let Some(&b) = bytes.get(after) {
            if b == b'>' || b.is_ascii_whitespace() {
                matches.push((pos, after + 1));
                from = after + 1;
                continue;
            }
        }
        from = pos + 1;
    }
    let mut blocks = Vec::with_capacity(matches.len());
    for i in 0..matches.len() {
        let start = matches[i].1;
        let end = if i + 1 < matches.len() {
            matches[i + 1].0
        } else {
            bytes.len()
        };
        blocks.push(&xml[start..end]);
    }
    blocks
}

/// Pull the handful of display-relevant fields out of the ZISRAWMETADATA XML.
/// Mirrors TS `cziXmlMetadata()`. Infallible (a malformed/unexpected XML
/// shape just yields fewer fields, matching the TS `try {} catch { {} }`
/// wrapper around the caller).
fn czi_xml_metadata(xml: &str) -> Vec<(String, JsonValue)> {
    let mut fields: Vec<(String, JsonValue)> = Vec::new();
    if let Some(name) = tag_text(xml, "Name") {
        if !name.is_empty() {
            fields.push(("documentName".to_string(), JsonValue::Str(name)));
        }
    }
    // Scaling is metres per pixel; report micrometres, which is the working unit here.
    for axis in ["X", "Y", "Z"] {
        let tag = format!("Scaling{}", axis);
        let value = tag_text(xml, &tag)
            .map(|s| js_number(&s))
            .unwrap_or(f64::NAN);
        if value.is_finite() && value > 0.0 {
            fields.push((format!("scaling{}Um", axis), JsonValue::Num(value * 1e6)));
        }
    }
    // Only real dye names ("DAPI", "Alexa Fluor 594"). A synthesized
    // "Channel 2" carries no information a slider reading does not, and
    // emitting one makes an unnamed channel look named downstream — where the
    // presence of names is what decides dropdown versus slider.
    let mut channel_names: Vec<String> = Vec::new();
    let mut any_missing = false;
    for block in channel_blocks(xml) {
        match dye_name(block).filter(|name| !name.is_empty()) {
            Some(name) => channel_names.push(name),
            None => any_missing = true,
        }
    }
    if any_missing {
        channel_names.clear();
    }
    // Channels are listed once per XML section (acquisition and display
    // setting), so keep only the first SizeC entries rather than every
    // repetition.
    let size_c = tag_text(xml, "SizeC")
        .map(|s| js_number(&s))
        .unwrap_or(f64::NAN);
    if !channel_names.is_empty() {
        let take = if size_c.is_finite() && size_c > 0.0 {
            (size_c as usize).min(channel_names.len())
        } else {
            channel_names.len()
        };
        fields.push((
            "channelNames".to_string(),
            JsonValue::Arr(
                channel_names[..take]
                    .iter()
                    .map(|s| JsonValue::Str(s.clone()))
                    .collect(),
            ),
        ));
    }
    fields
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/// `{ indices?: Record<string, number> }`.
struct DecodeOptions {
    indices: HashMap<String, f64>,
}

fn parse_options(options_json: &str) -> DecodeOptions {
    let mut out = DecodeOptions {
        indices: HashMap::new(),
    };
    if options_json.trim().is_empty() {
        return out;
    }
    let Ok(root) = super::json_value::parse(options_json) else {
        return out;
    };
    if let Some(indices) = root.get("indices").and_then(|v| v.as_obj()) {
        for (k, v) in indices {
            if let Some(n) = v.as_num() {
                out.indices.insert(k.clone(), n);
            }
        }
    }
    out
}

/// JS `Math.round()`: ties round toward +Infinity (unlike Rust's `f64::round`,
/// which rounds ties away from zero).
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

// ---------------------------------------------------------------------------
// Main decode
// ---------------------------------------------------------------------------

/// Decode a Zeiss CZI plane. Mirrors TS `parseCzi()`.
pub(crate) fn decode_czi_impl(
    data: &[u8],
    options_json: &str,
) -> Result<ScientificParsed, DecodeError> {
    if data.len() < 32 || ascii(data, 0, 10) != "ZISRAWFILE" {
        return Err(DecodeError::new("Invalid CZI signature"));
    }
    let options = parse_options(options_json);

    let header = czi_segment(data, 0)?.data_start;
    let file_part = i32_le(data, add(header, 0x30)?)?;
    if file_part != 0 {
        return Err(DecodeError::new(
            "Multi-file CZI sets are not supported; open the master file (part 0)",
        ));
    }
    let directory_position = i64_le(data, add(header, 0x34)?)?;
    let metadata_position = i64_le(data, add(header, 0x3c)?)?;

    let mut xml_metadata: Vec<(String, JsonValue)> = Vec::new();
    if metadata_position > 0 && metadata_position + 32 < data.len() as i64 {
        let segment = czi_segment(data, metadata_position)?;
        if segment.id == "ZISRAWMETADATA" {
            let xml_size = i32_le(data, segment.data_start)?;
            if xml_size > 0 {
                // Fixed part of the metadata segment is 256 bytes; the XML follows.
                let start = add(segment.data_start, 256)?;
                if start < data.len() {
                    let end = start
                        .checked_add(xml_size as usize)
                        .unwrap_or(data.len())
                        .min(data.len());
                    let xml = String::from_utf8_lossy(&data[start..end]);
                    xml_metadata = czi_xml_metadata(&xml);
                }
            }
        }
    }

    let all_entries = czi_subblock_entries(data, directory_position)?;
    if all_entries.is_empty() {
        return Err(DecodeError::new("CZI file contains no image subblocks"));
    }
    // Pyramid levels store a downscaled copy of the same coordinate; keep full res.
    let entries: Vec<CziDirectoryEntry> = all_entries
        .into_iter()
        .filter(|entry| {
            let x = find_dim(&entry.dimensions, "X");
            let y = find_dim(&entry.dimensions, "Y");
            match (x, y) {
                (Some(x), Some(y)) => x.size == x.stored_size && y.size == y.stored_size,
                _ => false,
            }
        })
        .collect();
    if entries.is_empty() {
        return Err(DecodeError::new(
            "CZI file contains no full-resolution subblocks",
        ));
    }

    let base_pixel_type_id = entries[0].pixel_type;
    let pixel_type = pixel_type_info(base_pixel_type_id).ok_or_else(|| {
        DecodeError::new(&format!(
            "Unsupported CZI pixel type: {}",
            base_pixel_type_id
        ))
    })?;

    // Axis extents across every subblock, spatial axes excluded. Order
    // matches TS object insertion order (first-seen axis name wins position).
    let mut axis_order: Vec<String> = Vec::new();
    let mut axes: HashMap<String, (i64, i64)> = HashMap::new(); // name -> (min, max)
    for entry in &entries {
        for (name, dim) in &entry.dimensions {
            if name == "X" || name == "Y" {
                continue;
            }
            let lo = dim.start as i64;
            let hi = dim.start as i64 + (dim.size as i64).max(1) - 1;
            match axes.get_mut(name) {
                Some(range) => {
                    range.0 = range.0.min(lo);
                    range.1 = range.1.max(hi);
                }
                None => {
                    axis_order.push(name.clone());
                    axes.insert(name.clone(), (lo, hi));
                }
            }
        }
    }
    // Mosaic tiles share a coordinate, so M selects nothing the user cares about.
    axes.remove("M");
    axis_order.retain(|n| n != "M");

    let mut requested: HashMap<String, i64> = HashMap::new();
    for name in &axis_order {
        let (min, max) = axes[name];
        let wanted = options.indices.get(name).copied().unwrap_or(f64::NAN);
        let offset = if wanted.is_finite() {
            js_round(wanted) as i64
        } else {
            0
        };
        let value = (min + offset).max(min).min(max);
        requested.insert(name.clone(), value);
    }

    let selected: Vec<&CziDirectoryEntry> = entries
        .iter()
        .filter(|entry| {
            axis_order.iter().all(|name| {
                let value = requested[name];
                match find_dim(&entry.dimensions, name) {
                    None => true,
                    Some(dim) => {
                        let start = dim.start as i64;
                        let end = start + (dim.size as i64).max(1);
                        value >= start && value < end
                    }
                }
            })
        })
        .collect();
    if selected.is_empty() {
        return Err(DecodeError::new(
            "No CZI subblock matches the requested plane",
        ));
    }

    let mut min_x = i64::MAX;
    let mut min_y = i64::MAX;
    let mut max_x = i64::MIN;
    let mut max_y = i64::MIN;
    for entry in &selected {
        // Guaranteed present: `entries` was filtered to require X and Y above.
        let x = find_dim(&entry.dimensions, "X")
            .ok_or_else(|| DecodeError::new("CZI subblock is missing the X dimension"))?;
        let y = find_dim(&entry.dimensions, "Y")
            .ok_or_else(|| DecodeError::new("CZI subblock is missing the Y dimension"))?;
        min_x = min_x.min(x.start as i64);
        min_y = min_y.min(y.start as i64);
        max_x = max_x.max(x.start as i64 + x.size as i64);
        max_y = max_y.max(y.start as i64 + y.size as i64);
    }
    let width_i64 = max_x - min_x;
    let height_i64 = max_y - min_y;
    if !(width_i64 > 0 && height_i64 > 0) {
        return Err(DecodeError::new("CZI plane has an empty extent"));
    }
    let width = i64_to_usize(width_i64, "plane width")?;
    let height = i64_to_usize(height_i64, "plane height")?;
    let channels = pixel_type.channels as usize;
    let bytes_per_channel = pixel_type.bytes_per_channel as usize;

    // Validate BEFORE allocating the raster. A large mosaic of compressed
    // subblocks would otherwise try to reserve the whole plane first, and on
    // wasm32 (32-bit usize) that allocation aborts the module with a capacity
    // overflow panic instead of returning the "unsupported codec" message the
    // native build produces from the loop below. Same inputs must give the
    // same answer on both targets.
    for entry in &selected {
        if entry.compression != 0 {
            let codec = compression_name(entry.compression);
            return Err(DecodeError::new(&format!(
                "Compressed CZI is not supported yet ({}); only uncompressed subblocks decode",
                codec
            )));
        }
        if entry.pixel_type != base_pixel_type_id {
            return Err(DecodeError::new("Mixed pixel types in one CZI plane"));
        }
    }

    let pixel_count = mul(mul(width, height)?, channels)?;
    // `vec![0f32; n]` panics on a request the allocator cannot express; a plane
    // too large for the target must be a decode error, never an abort.
    let mut out: Vec<f32> = Vec::new();
    out.try_reserve_exact(pixel_count).map_err(|_| {
        DecodeError::new(&format!(
            "CZI plane is too large to decode on this target: {}x{}x{} samples",
            width, height, channels
        ))
    })?;
    out.resize(pixel_count, 0.0);

    for entry in &selected {
        let segment = czi_segment(data, entry.file_position)?;
        if segment.id != "ZISRAWSUBBLOCK" {
            return Err(DecodeError::new(&format!(
                "Expected ZISRAWSUBBLOCK at {}, found \"{}\"",
                entry.file_position, segment.id
            )));
        }
        let metadata_size = i32_le(data, segment.data_start)?;
        let inline_entry = czi_directory_entry(data, add(segment.data_start, 16)?)?;
        // The fixed part of a subblock header is padded to at least 256 bytes.
        let fixed_size = add(16, inline_entry.byte_length)?.max(256);
        let meta_extra = if metadata_size > 0 {
            metadata_size as usize
        } else {
            0
        };
        let pixels_start = add(add(segment.data_start, fixed_size)?, meta_extra)?;

        let dim_x = find_dim(&entry.dimensions, "X")
            .ok_or_else(|| DecodeError::new("CZI subblock is missing the X dimension"))?;
        let dim_y = find_dim(&entry.dimensions, "Y")
            .ok_or_else(|| DecodeError::new("CZI subblock is missing the Y dimension"))?;
        let tile_width = (dim_x.size.max(0)) as usize;
        let tile_height = (dim_y.size.max(0)) as usize;
        let stride = mul(mul(tile_width, channels)?, bytes_per_channel)?;
        let total_needed = mul(stride, tile_height)?;
        if pixels_start
            .checked_add(total_needed)
            .map(|end| end > data.len())
            .unwrap_or(true)
        {
            return Err(DecodeError::new("CZI subblock data is truncated"));
        }

        let origin_x = i64_to_usize(dim_x.start as i64 - min_x, "tile origin")?;
        let origin_y = i64_to_usize(dim_y.start as i64 - min_y, "tile origin")?;

        for row in 0..tile_height {
            let source_row = add(pixels_start, mul(row, stride)?)?;
            let target_row = mul(add(origin_y, row)?, width)?;
            let target_row = add(target_row, origin_x)?;
            let target_row = mul(target_row, channels)?;
            let mut source = source_row;
            let mut target = target_row;
            for _col in 0..tile_width {
                for channel in 0..channels {
                    let sample_offset = add(source, mul(channel, bytes_per_channel)?)?;
                    let value = read_sample(data, entry.pixel_type, sample_offset)?;
                    // BGR(A) types are stored channel-reversed for the colour triple.
                    let index = if pixel_type.bgr && channel < 3 {
                        2 - channel
                    } else {
                        channel
                    };
                    if let Some(slot) = out.get_mut(target + index) {
                        *slot = value as f32;
                    }
                }
                source = add(source, mul(channels, bytes_per_channel)?)?;
                target = add(target, channels)?;
            }
        }
    }

    // --- Metadata --------------------------------------------------------
    let selectors: Vec<(String, i64, i64)> = CZI_AXIS_ORDER
        .iter()
        .map(|s| s.to_string())
        .chain(
            axis_order
                .iter()
                .filter(|n| !CZI_AXIS_ORDER.contains(&n.as_str()))
                .cloned(),
        )
        .filter(|name| axes.contains_key(name))
        .filter_map(|name| {
            let (min, max) = axes[&name];
            let size = max - min + 1;
            if size > 1 {
                Some((name.clone(), size, requested[&name] - min))
            } else {
                None
            }
        })
        .collect();

    let channel_index = axes
        .get("C")
        .map(|(min, _)| requested.get("C").copied().unwrap_or(0) - min)
        .unwrap_or(0);
    let channel_names: Option<Vec<String>> = xml_metadata
        .iter()
        .find(|(k, _)| k == "channelNames")
        .and_then(|(_, v)| match v {
            JsonValue::Arr(items) => Some(
                items
                    .iter()
                    .filter_map(|i| i.as_str().map(|s| s.to_string()))
                    .collect(),
            ),
            _ => None,
        });
    let channel_name = channel_names.as_ref().and_then(|names| {
        if channel_index >= 0 {
            names.get(channel_index as usize).cloned()
        } else {
            None
        }
    });

    let mut fields: Vec<(String, JsonValue)> = xml_metadata;
    fields.push(("format".to_string(), JsonValue::Str("CZI".to_string())));
    fields.push((
        "pixelTypeName".to_string(),
        JsonValue::Str(pixel_type.name.to_string()),
    ));
    fields.push((
        "subBlockCount".to_string(),
        JsonValue::Num(entries.len() as f64),
    ));
    fields.push((
        "tileCount".to_string(),
        JsonValue::Num(selected.len() as f64),
    ));
    fields.push((
        "selectors".to_string(),
        JsonValue::Arr(
            selectors
                .iter()
                .map(|(name, size, value)| {
                    let mut entry = vec![
                        ("name".to_string(), JsonValue::Str(name.clone())),
                        ("size".to_string(), JsonValue::Num(*size as f64)),
                        ("value".to_string(), JsonValue::Num(*value as f64)),
                    ];
                    // A selector whose options the FILE names carries them here.
                    // The viewer has one rule — named options are a choice,
                    // unnamed ones are an axis — and no knowledge of formats, so
                    // every decoder must answer this question itself.
                    if name == "C" {
                        if let Some(names) = channel_names.as_ref() {
                            if names.len() == *size as usize {
                                entry.push((
                                    "labels".to_string(),
                                    JsonValue::Arr(
                                        names.iter().map(|n| JsonValue::Str(n.clone())).collect(),
                                    ),
                                ));
                            }
                        }
                    }
                    JsonValue::Obj(entry)
                })
                .collect(),
        ),
    ));
    fields.push((
        "selectedIndices".to_string(),
        JsonValue::Obj(
            selectors
                .iter()
                .map(|(name, _, value)| (name.clone(), JsonValue::Num(*value as f64)))
                .collect(),
        ),
    ));
    push_opt(&mut fields, "channelName", channel_name.map(JsonValue::Str));
    let metadata_json = to_json_string(&JsonValue::Obj(fields));

    Ok(ScientificParsed {
        width: width as u32,
        height: height as u32,
        channels: pixel_type.channels,
        bits_per_sample: pixel_type.bits_per_sample,
        sample_format: pixel_type.sample_format,
        type_min: pixel_type.type_min,
        type_max: pixel_type.type_max,
        source_numeric_type: pixel_type.source_numeric_type.to_string(),
        metadata_json,
        data: out,
    })
}

