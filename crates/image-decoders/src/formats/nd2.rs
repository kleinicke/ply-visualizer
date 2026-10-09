//! Nikon ND2 decoder (modern chunk-based files, `Ver3.0` and later).
//!
//! An ND2 is a flat sequence of length-prefixed chunks. Each chunk is
//! `[u32 magic = 0x0ABECEDA][u32 name_len][u64 data_len][name][data]`, and a
//! chunk map at the end of the file lists every chunk by name with its offset
//! and length, so nothing has to be found by scanning. The last 8 bytes of the
//! file hold the chunk map's own offset, preceded by the 32-byte ASCII
//! signature `ND2 CHUNK MAP SIGNATURE 0000001!`.
//!
//! Pixels live in `ImageDataSeq|<n>!` chunks, one per acquired frame, each
//! holding an `f64` timestamp followed by channel-interleaved samples. Frames
//! are addressed by a single flat sequence index; the multi-dimensional shape
//! (time / stage position / Z / ...) is a separate matter reconstructed from
//! the experiment loop descriptors — see `axis_model()`.
//!
//! Metadata is Nikon's "LV" format: a recursive, self-describing tree of typed
//! key/value pairs with UTF-16LE names, parsed by `parse_lv()`. It is what
//! carries the frame geometry (`ImageAttributesLV`), the pixel calibration
//! (`ImageCalibrationLV`) and the loop structure (`ImageMetadataLV`).
//!
//! Only uncompressed frames (`eCompression == 2`) decode. Nikon's lossless and
//! lossy modes are rejected by name rather than guessed at, matching how
//! `czi.rs` handles codecs it does not implement.

use super::half::f16_to_f32;
use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{get_slice, is_need_range, ScientificParsed, SparseFile};
use crate::DecodeError;
use std::collections::HashMap;

const CHUNK_MAGIC: u32 = 0x0ABE_CEDA;
const MAP_SIGNATURE: &str = "ND2 CHUNK MAP SIGNATURE 0000001!";

// ---------------------------------------------------------------------------
// Little-endian readers
// ---------------------------------------------------------------------------

fn u32_le(data: &[u8], offset: usize) -> Result<u32, DecodeError> {
    let bytes = get_slice(data, offset, 4, "ND2")?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn u64_le(data: &[u8], offset: usize) -> Result<u64, DecodeError> {
    let bytes = get_slice(data, offset, 8, "ND2")?;
    Ok(u64::from_le_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    ]))
}

fn f64_le(data: &[u8], offset: usize) -> Result<f64, DecodeError> {
    Ok(f64::from_bits(u64_le(data, offset)?))
}

fn add(a: usize, b: usize) -> Result<usize, DecodeError> {
    a.checked_add(b)
        .ok_or_else(|| DecodeError::new("ND2 offset arithmetic overflowed"))
}

fn mul(a: usize, b: usize) -> Result<usize, DecodeError> {
    a.checked_mul(b)
        .ok_or_else(|| DecodeError::new("ND2 size arithmetic overflowed"))
}

fn u64_to_usize(value: u64, what: &str) -> Result<usize, DecodeError> {
    usize::try_from(value).map_err(|_| DecodeError::new(format!("ND2 {} is too large", what)))
}

// ---------------------------------------------------------------------------
// LV metadata tree
// ---------------------------------------------------------------------------

/// One value in Nikon's LV key/value tree.
#[derive(Debug, Clone)]
enum Lv {
    Bool(bool),
    Int(i64),
    Float(f64),
    Str(String),
    Bytes,
    Map(Vec<(String, Lv)>),
}

impl Lv {
    fn get(&self, key: &str) -> Option<&Lv> {
        match self {
            Lv::Map(fields) => fields.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// Numeric coercion across the integer/float/bool encodings, so callers do
    /// not have to care which width Nikon used for a given field.
    fn as_f64(&self) -> Option<f64> {
        match self {
            Lv::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            Lv::Int(i) => Some(*i as f64),
            Lv::Float(f) => Some(*f),
            _ => None,
        }
    }

    fn as_i64(&self) -> Option<i64> {
        self.as_f64().map(|v| v as i64)
    }

    fn as_str(&self) -> Option<&str> {
        match self {
            Lv::Str(s) => Some(s.as_str()),
            _ => None,
        }
    }

    /// `self["a"]["b"]["c"]` for a dotted path, returning `None` at the first
    /// missing link.
    fn path(&self, path: &[&str]) -> Option<&Lv> {
        let mut node = self;
        for key in path {
            node = node.get(key)?;
        }
        Some(node)
    }
}

/// Decode `count` UTF-16LE code units at `offset` into a `String`, stopping at
/// the first NUL. Unpaired surrogates are replaced rather than rejected: these
/// are display strings, and a malformed name must not fail the whole decode.
fn utf16_at(data: &[u8], offset: usize, units: usize) -> Result<String, DecodeError> {
    let bytes = get_slice(data, offset, mul(units, 2)?, "ND2 metadata name")?;
    let mut code_units = Vec::with_capacity(units);
    for pair in bytes.chunks_exact(2) {
        let unit = u16::from_le_bytes([pair[0], pair[1]]);
        if unit == 0 {
            break;
        }
        code_units.push(unit);
    }
    Ok(String::from_utf16_lossy(&code_units))
}

/// Parse one LV level from `data[offset..end]`.
///
/// Each entry is `[u8 type][u8 name_len_in_utf16_units][name][value]`. A type
/// of `11` opens a nested level whose declared byte length covers the header
/// that introduced it, which is why the child range is computed by subtracting
/// the already-consumed header bytes rather than by trusting a separate size.
///
/// `depth` guards against a malformed file describing unbounded nesting.
fn parse_lv(data: &[u8], mut offset: usize, end: usize, depth: u32) -> (Vec<(String, Lv)>, usize) {
    let mut fields: Vec<(String, Lv)> = Vec::new();
    if depth > 32 {
        return (fields, end);
    }
    while offset + 2 <= end {
        let value_type = data[offset];
        let name_units = data[offset + 1] as usize;
        if value_type == 0 || name_units == 0 {
            break;
        }
        let header_start = offset;
        offset += 2;
        let Ok(name) = utf16_at(data, offset, name_units) else {
            break;
        };
        let Ok(after_name) = add(offset, mul(name_units, 2).unwrap_or(usize::MAX)) else {
            break;
        };
        offset = after_name;
        let value = match value_type {
            1 => match data.get(offset) {
                Some(&b) => {
                    offset += 1;
                    Lv::Bool(b != 0)
                }
                None => break,
            },
            2 | 3 => match u32_le(data, offset) {
                Ok(v) => {
                    offset += 4;
                    // Type 2 is signed, type 3 unsigned; both are 32 bits wide.
                    Lv::Int(if value_type == 2 {
                        v as i32 as i64
                    } else {
                        v as i64
                    })
                }
                Err(_) => break,
            },
            4 | 5 | 7 => match u64_le(data, offset) {
                Ok(v) => {
                    offset += 8;
                    Lv::Int(v as i64)
                }
                Err(_) => break,
            },
            6 => match f64_le(data, offset) {
                Ok(v) => {
                    offset += 8;
                    Lv::Float(v)
                }
                Err(_) => break,
            },
            8 => {
                // NUL-terminated UTF-16LE, length not declared up front.
                let mut cursor = offset;
                let mut units: Vec<u16> = Vec::new();
                loop {
                    if cursor + 2 > end {
                        break;
                    }
                    let unit = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
                    cursor += 2;
                    if unit == 0 {
                        break;
                    }
                    units.push(unit);
                }
                offset = cursor;
                Lv::Str(String::from_utf16_lossy(&units))
            }
            9 => match u64_le(data, offset) {
                Ok(len) => {
                    offset += 8;
                    let len = u64_to_usize(len, "byte array").unwrap_or(0);
                    offset = offset.saturating_add(len).min(end);
                    Lv::Bytes
                }
                Err(_) => break,
            },
            11 => {
                // [u32 child_count][u64 total_length], where total_length spans
                // this entry's own header as well as the children.
                let Ok(total) = u64_le(data, add(offset, 4).unwrap_or(usize::MAX)) else {
                    break;
                };
                offset += 12;
                let header_bytes = offset - header_start;
                let total = u64_to_usize(total, "metadata level length").unwrap_or(0);
                let child_end = header_start.saturating_add(total).min(end).max(offset);
                let (children, _) = parse_lv(data, offset, child_end, depth + 1);
                offset = child_end;
                let _ = header_bytes;
                Lv::Map(children)
            }
            // An unknown type carries an unknown width, so the rest of this
            // level can no longer be located; stop instead of desynchronising.
            _ => break,
        };
        fields.push((name, value));
    }
    (fields, offset)
}

fn parse_lv_root(data: &[u8]) -> Lv {
    let (fields, _) = parse_lv(data, 0, data.len(), 0);
    Lv::Map(fields)
}

// ---------------------------------------------------------------------------
// XML `<variant>` metadata
// ---------------------------------------------------------------------------

/// Older chunk-based ND2 files store the same metadata as an XML `<variant>`
/// document instead of the binary LV tree: `ImageAttributes!` rather than
/// `ImageAttributesLV!`. The element names are identical (`uiWidth`, `uiComp`,
/// `eCompression`, ...), so parsing both encodings into one `Lv` lets every
/// consumer below stay unaware of which one a given file used.
///
/// Scalars are `<name runtype="lx_uint32" value="696"/>`; nested levels are
/// `<name runtype="CLxListVariant"> ... </name>`.
fn parse_xml_variant(text: &str) -> Lv {
    let bytes = text.as_bytes();
    let mut cursor = 0usize;
    // Skip the XML declaration and the outer <variant> wrapper.
    let (fields, _) = parse_xml_level(bytes, &mut cursor, 0);
    Lv::Map(fields)
}

/// Read `name="value"` out of a tag's attribute text.
fn xml_attribute(tag: &str, name: &str) -> Option<String> {
    let needle = format!("{}=\"", name);
    let start = tag.find(&needle)? + needle.len();
    let rest = &tag[start..];
    let end = rest.find('"')?;
    Some(unescape_xml(&rest[..end]))
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

/// Parse sibling elements until the enclosing element closes, returning the
/// fields collected and stopping at the parent's closing tag.
fn parse_xml_level(bytes: &[u8], cursor: &mut usize, depth: u32) -> (Vec<(String, Lv)>, bool) {
    let mut fields: Vec<(String, Lv)> = Vec::new();
    if depth > 32 {
        return (fields, true);
    }
    loop {
        // Advance to the next tag.
        let Some(open_rel) = bytes[*cursor..].iter().position(|&b| b == b'<') else {
            return (fields, true);
        };
        let open = *cursor + open_rel;
        let Some(close_rel) = bytes[open..].iter().position(|&b| b == b'>') else {
            return (fields, true);
        };
        let close = open + close_rel;
        let tag = String::from_utf8_lossy(&bytes[open + 1..close]).into_owned();
        *cursor = close + 1;

        if tag.starts_with('/') {
            // Parent closed.
            return (fields, false);
        }
        if tag.starts_with('?') || tag.starts_with('!') {
            continue;
        }
        let self_closing = tag.ends_with('/');
        let tag_body = tag.trim_end_matches('/');
        let name = tag_body
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_string();
        if name.is_empty() {
            continue;
        }
        // `<variant>` is only a wrapper; descend through it without recording it.
        if name.eq_ignore_ascii_case("variant") && !self_closing {
            let (inner, _) = parse_xml_level(bytes, cursor, depth + 1);
            fields.extend(inner);
            continue;
        }
        let runtype = xml_attribute(tag_body, "runtype").unwrap_or_default();
        if self_closing {
            let raw = xml_attribute(tag_body, "value").unwrap_or_default();
            fields.push((name, xml_scalar(&runtype, &raw)));
            continue;
        }
        // A container: recurse. `no_name` levels are Nikon's anonymous
        // wrappers, so their children are hoisted into the parent rather than
        // nested under a meaningless key.
        let (children, _) = parse_xml_level(bytes, cursor, depth + 1);
        if name == "no_name" {
            fields.extend(children);
        } else {
            fields.push((name, Lv::Map(children)));
        }
    }
}

/// Coerce an XML `value` attribute using its declared `runtype`.
fn xml_scalar(runtype: &str, raw: &str) -> Lv {
    let lower = runtype.to_ascii_lowercase();
    if lower.starts_with("lx_int") || lower.starts_with("lx_uint") {
        return raw
            .trim()
            .parse::<i64>()
            .map(Lv::Int)
            .unwrap_or_else(|_| Lv::Str(raw.to_string()));
    }
    if lower == "double" || lower == "lx_double" {
        return raw
            .trim()
            .parse::<f64>()
            .map(Lv::Float)
            .unwrap_or_else(|_| Lv::Str(raw.to_string()));
    }
    if lower == "bool" || lower == "lx_bool" {
        return Lv::Bool(raw.trim() == "1" || raw.trim().eq_ignore_ascii_case("true"));
    }
    Lv::Str(raw.to_string())
}

/// Parse a metadata chunk in whichever encoding it uses.
///
/// The two are trivially distinguishable: the XML form opens with `<?xml` (or
/// at least a `<`), the binary LV form opens with a small type byte.
fn metadata_tree(payload: &[u8]) -> Lv {
    let leading = payload
        .iter()
        .position(|&b| !b.is_ascii_whitespace())
        .unwrap_or(0);
    if payload.get(leading) == Some(&b'<') {
        let text = String::from_utf8_lossy(payload);
        parse_xml_variant(&text)
    } else {
        parse_lv_root(payload)
    }
}

/// Find a metadata chunk by base name, tolerating the spelling differences
/// between ND2 generations: `ImageAttributes!`, `ImageAttributesLV!` and
/// `ImageAttributesLV|0!` all name the same thing.
fn find_chunk<'a>(chunks: &'a HashMap<String, Chunk>, base: &str) -> Option<&'a Chunk> {
    let exact = format!("{}!", base);
    if let Some(chunk) = chunks.get(&exact) {
        return Some(chunk);
    }
    let with_lv = format!("{}LV!", base);
    if let Some(chunk) = chunks.get(&with_lv) {
        return Some(chunk);
    }
    // Any `<base>[LV]|<n>!` spelling; take the lowest-numbered.
    let mut candidates: Vec<(&String, &Chunk)> = chunks
        .iter()
        .filter(|(name, _)| {
            let stem = name.trim_end_matches('!');
            let stem = stem.split('|').next().unwrap_or(stem);
            stem == base || stem == format!("{}LV", base)
        })
        .collect();
    candidates.sort_by(|a, b| a.0.cmp(b.0));
    candidates.first().map(|(_, chunk)| *chunk)
}

/// Unwrap the single named root a metadata document wraps its fields in
/// (`SLxImageAttributes`, `SLxExperiment`, ...). The XML form hoists its
/// anonymous `no_name` root during parsing, so the fields are already at the
/// top level there; this returns the tree itself in that case.
fn unwrap_root<'a>(tree: &'a Lv, name: &str) -> &'a Lv {
    tree.get(name).unwrap_or(tree)
}

// ---------------------------------------------------------------------------
// Chunk map
// ---------------------------------------------------------------------------

/// A chunk-map entry. The authoritative payload length lives in the chunk's
/// own header, and the two disagree in files written by an interrupted
/// acquisition; the map's `length` is only used as a hint for how many bytes
/// to request at once from a partially read file.
struct Chunk {
    offset: u64,
    length: u64,
}

/// Slack added to a chunk-map length when requesting a whole chunk, so the
/// header, name and payload arrive together whatever the length covers.
const CHUNK_FETCH_SLACK: usize = 4096;
/// How much of the file's end is requested first: the trailer plus, usually,
/// the whole chunk map.
const TAIL_FETCH: usize = 64 * 1024;
/// Metadata chunks closer together than this are fetched in one request.
const METADATA_SPAN_LIMIT: usize = 2 * 1024 * 1024;

fn u32_at(file: &SparseFile<'_>, offset: usize, want: usize) -> Result<u32, DecodeError> {
    let bytes = file.slice_want(offset, 4, want, "ND2")?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn u64_at(file: &SparseFile<'_>, offset: usize, want: usize) -> Result<u64, DecodeError> {
    let bytes = file.slice_want(offset, 8, want, "ND2")?;
    let mut array = [0u8; 8];
    array.copy_from_slice(bytes);
    Ok(u64::from_le_bytes(array))
}

/// Bytes to request when a chunk is missing: the map's length plus the
/// 16-byte header, the name and slack.
fn chunk_want(chunk: &Chunk) -> usize {
    usize::try_from(chunk.length)
        .unwrap_or(0)
        .saturating_add(16 + CHUNK_FETCH_SLACK)
}

/// Read the payload of the chunk whose header starts at `position`.
///
/// `want` is how many bytes from the header on to request when they are
/// missing; the payload itself is bounded by the header's own length.
fn chunk_payload<'a>(
    file: &SparseFile<'a>,
    position: u64,
    want: usize,
) -> Result<&'a [u8], DecodeError> {
    let start = u64_to_usize(position, "chunk offset")?;
    let magic = u32_at(file, start, want)?;
    if magic != CHUNK_MAGIC {
        return Err(DecodeError::new(format!(
            "Bad ND2 chunk magic 0x{:08X} at offset {}",
            magic, position
        )));
    }
    let name_length = u64_to_usize(
        u64::from(u32_at(file, add(start, 4)?, 4)?),
        "chunk name length",
    )?;
    let data_length = u64_to_usize(u64_at(file, add(start, 8)?, 8)?, "chunk length")?;
    let payload_start = add(add(start, 16)?, name_length)?;
    file.slice(payload_start, data_length, "ND2 chunk")
}

/// A metadata chunk that is optional: any failure but a request for more
/// bytes means "absent", exactly as the whole-file decoder treats it.
fn optional_payload<'a>(
    file: &SparseFile<'a>,
    chunk: Option<&Chunk>,
) -> Result<Option<&'a [u8]>, DecodeError> {
    let Some(chunk) = chunk else {
        return Ok(None);
    };
    match chunk_payload(file, chunk.offset, chunk_want(chunk)) {
        Ok(payload) => Ok(Some(payload)),
        Err(error) if is_need_range(&error) => Err(error),
        Err(_) => Ok(None),
    }
}

/// Ask for the metadata chunks that sit close together (they are written back
/// to back) in one request per group, so they cost one round trip per group,
/// not one per chunk. Purely an optimisation: failures other than "bytes not
/// read yet" are ignored and left to the real reads.
fn prefetch_metadata(file: &SparseFile<'_>, chunks: &[Option<&Chunk>]) -> Result<(), DecodeError> {
    let mut spans: Vec<(usize, usize)> = chunks
        .iter()
        .flatten()
        .filter_map(|chunk| {
            let start = usize::try_from(chunk.offset).ok()?;
            let end = start.saturating_add(chunk_want(chunk)).min(file.len());
            (start < end).then_some((start, end))
        })
        .collect();
    spans.sort_unstable();
    let mut groups: Vec<(usize, usize)> = Vec::new();
    for (start, end) in spans {
        match groups.last_mut() {
            Some(group) if end - group.0 <= METADATA_SPAN_LIMIT => group.1 = group.1.max(end),
            _ => groups.push((start, end)),
        }
    }
    for (start, end) in groups {
        match file.slice(start, end - start, "ND2 chunk") {
            Err(error) if is_need_range(&error) => return Err(error),
            _ => {}
        }
    }
    Ok(())
}

/// Parse the chunk map into `name -> (offset, length)`.
///
/// Entries are `<name>!` (the trailing `!` is part of Nikon's naming) followed
/// by a `u64` offset and a `u64` length. The map ends at its own signature
/// entry, which points at the map itself and must not be walked into.
fn parse_chunk_map(map: &[u8]) -> HashMap<String, Chunk> {
    let mut chunks = HashMap::new();
    let mut offset = 0usize;
    while offset < map.len() {
        let Some(relative) = map[offset..].iter().position(|&b| b == b'!') else {
            break;
        };
        let name_end = offset + relative + 1;
        let name = String::from_utf8_lossy(&map[offset..name_end]).into_owned();
        if name.starts_with("ND2 CHUNK MAP SIGNATURE") {
            break;
        }
        let Ok(chunk_offset) = u64_le(map, name_end) else {
            break;
        };
        let Ok(chunk_length) = u64_le(map, name_end + 8) else {
            break;
        };
        chunks.insert(
            name,
            Chunk {
                offset: chunk_offset,
                length: chunk_length,
            },
        );
        offset = name_end + 16;
    }
    chunks
}

// ---------------------------------------------------------------------------
// Pixel geometry
// ---------------------------------------------------------------------------

struct PixelType {
    name: &'static str,
    bytes_per_sample: usize,
    bits_per_sample: u32,
    sample_format: u32,
    type_min: f64,
    type_max: f64,
    source_numeric_type: &'static str,
}

/// Map `uiBpcInMemory` plus `ePixelType` onto a sample layout.
///
/// `ePixelType` is `1` for the ordinary unsigned integer cases and `2` for
/// floating point. This was verified against a 32-bit SIM reconstruction
/// (`ePixelType = 2`): read as `f32` its samples span 935..1601, which are
/// plausible reconstructed intensities, while the same bytes read as `u32`
/// give 1.1e9 — noise. `3` is accepted as float too, since Nikon's own
/// headers are inconsistent about which of the two they write.
fn pixel_type(bits: u32, pixel_type_id: i64) -> Option<PixelType> {
    let is_float = pixel_type_id == 2 || pixel_type_id == 3;
    match (bits, is_float) {
        (8, false) => Some(PixelType {
            name: "uint8",
            bytes_per_sample: 1,
            bits_per_sample: 8,
            sample_format: 1,
            type_min: 0.0,
            type_max: 255.0,
            source_numeric_type: "uint8",
        }),
        (16, false) => Some(PixelType {
            name: "uint16",
            bytes_per_sample: 2,
            bits_per_sample: 16,
            sample_format: 1,
            type_min: 0.0,
            type_max: 65535.0,
            source_numeric_type: "uint16",
        }),
        (16, true) => Some(PixelType {
            name: "float16",
            bytes_per_sample: 2,
            bits_per_sample: 16,
            sample_format: 3,
            type_min: 0.0,
            type_max: 1.0,
            source_numeric_type: "float16",
        }),
        (32, false) => Some(PixelType {
            name: "uint32",
            bytes_per_sample: 4,
            bits_per_sample: 32,
            sample_format: 1,
            type_min: 0.0,
            type_max: 4294967295.0,
            source_numeric_type: "uint32",
        }),
        (32, true) => Some(PixelType {
            name: "float32",
            bytes_per_sample: 4,
            bits_per_sample: 32,
            sample_format: 3,
            type_min: 0.0,
            type_max: 1.0,
            source_numeric_type: "float32",
        }),
        (64, true) => Some(PixelType {
            name: "float64",
            bytes_per_sample: 8,
            bits_per_sample: 64,
            sample_format: 3,
            type_min: 0.0,
            type_max: 1.0,
            source_numeric_type: "float64",
        }),
        _ => None,
    }
}

fn read_sample(data: &[u8], kind: &PixelType, offset: usize) -> Result<f32, DecodeError> {
    let bytes = get_slice(data, offset, kind.bytes_per_sample, "ND2 pixel")?;
    Ok(match (kind.bytes_per_sample, kind.sample_format) {
        (1, _) => bytes[0] as f32,
        (2, 3) => f16_to_f32(u16::from_le_bytes([bytes[0], bytes[1]])),
        (2, _) => u16::from_le_bytes([bytes[0], bytes[1]]) as f32,
        (4, 3) => f32::from_bits(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
        (4, _) => u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32,
        (8, _) => f64::from_bits(u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ])) as f32,
        _ => return Err(DecodeError::new("Unsupported ND2 sample width")),
    })
}

// ---------------------------------------------------------------------------
// Axis model
// ---------------------------------------------------------------------------

/// A navigable dimension: name, extent, and the stride (in frames) between
/// consecutive coordinates along it.
struct Axis {
    name: String,
    size: usize,
    stride: usize,
}

/// Nikon experiment loop type -> axis name.
///
/// The mapping was confirmed against real files rather than assumed: in
/// `eType = 4` acquisitions the recorded per-frame Z steps in exact
/// increments (0.20 um and 1.00 um in two separate files) while timestamps
/// advance smoothly, which is a Z stack; in `eType = 1` acquisitions Z is
/// constant and the timestamps jump by the loop period, which is a time
/// series. 8 and 9 are the "no-events" and manual time loops, 10 the
/// high-accuracy Z stack, 6 the spectral loop.
fn loop_axis_name(loop_type: i64) -> &'static str {
    match loop_type {
        1 | 8 | 9 => "T",
        2 | 3 => "P",
        4 | 10 => "Z",
        6 => "L",
        _ => "Other",
    }
}

/// Reconstruct the dimension order from the experiment loop descriptors.
///
/// The loops are stored outermost-first, and the frame index is their mixed
/// radix. Nikon does not always record every loop: this file, for instance,
/// declares only its 31-point time loop even though the 1426 frames are 31
/// timepoints across 46 stage positions. When the declared loops leave an
/// exact integer factor unaccounted for, one synthetic innermost axis absorbs
/// it — that recovers the stage-position axis rather than presenting 1426
/// undifferentiated frames.
///
/// If the declared loops do not divide the frame count at all, the whole model
/// collapses to a single flat `Frame` axis. That is always addressable, so a
/// file with a loop structure this code does not understand still opens.
fn axis_model(experiment: &Lv, frame_count: usize) -> Vec<Axis> {
    let mut declared: Vec<(String, usize)> = Vec::new();
    let mut level = Some(unwrap_root(experiment, "SLxExperiment"));
    let mut depth = 0;
    while let Some(node) = level {
        if depth > 8 {
            break;
        }
        let loop_type = node.get("eType").and_then(Lv::as_i64).unwrap_or(-1);
        let count = node
            .path(&["uLoopPars", "uiCount"])
            .and_then(Lv::as_i64)
            .unwrap_or(0);
        if count > 1 {
            declared.push((loop_axis_name(loop_type).to_string(), count as usize));
        }
        level = node.get("pNextLevelEx");
        depth += 1;
    }

    let declared_product: usize = declared
        .iter()
        .map(|(_, size)| *size)
        .product::<usize>()
        .max(1);
    let mut axes: Vec<(String, usize)> = Vec::new();
    if declared_product == 0 || frame_count == 0 {
        return Vec::new();
    }
    if frame_count.is_multiple_of(declared_product) {
        axes.extend(declared.iter().cloned());
        let remainder = frame_count / declared_product;
        if remainder > 1 {
            // An undeclared innermost loop. Stage position is overwhelmingly
            // the common case; name it neutrally when a P loop was declared.
            let name = if axes.iter().any(|(n, _)| n == "P") {
                "S"
            } else {
                "P"
            };
            axes.push((name.to_string(), remainder));
        }
    } else {
        axes.push(("Frame".to_string(), frame_count));
    }

    // Strides run innermost-fastest: the last axis steps one frame at a time.
    let mut stride = 1usize;
    let mut out: Vec<Axis> = Vec::new();
    for (name, size) in axes.iter().rev() {
        out.push(Axis {
            name: name.clone(),
            size: *size,
            stride,
        });
        stride = stride.saturating_mul(*size);
    }
    out.reverse();
    out
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

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
        for (key, value) in indices {
            if let Some(number) = value.as_num() {
                out.indices.insert(key.clone(), number);
            }
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Main decode
// ---------------------------------------------------------------------------

pub(crate) fn decode_nd2_impl(
    data: &[u8],
    options_json: &str,
) -> Result<ScientificParsed, DecodeError> {
    decode_nd2_sparse(&SparseFile::whole(data), options_json)
}

/// Decode from a file of which only some ranges are present. Every byte is
/// read through `file` by absolute offset; a read of bytes not present yet
/// fails with a `[need-range:OFFSET:LENGTH]` error (see [`SparseFile`]), and
/// the caller supplies that range and calls again.
pub(crate) fn decode_nd2_sparse(
    file: &SparseFile<'_>,
    options_json: &str,
) -> Result<ScientificParsed, DecodeError> {
    let size = file.len();
    if size < 64 {
        return Err(DecodeError::new("ND2 file is truncated"));
    }
    // The head is only checked when it is already present: a file with a valid
    // trailer is a chunk file, and the head is fetched solely to tell a legacy
    // file (no valid trailer) from an invalid one.
    let head_magic = match u32_at(file, 0, 4) {
        Ok(magic) => Some(magic),
        Err(error) if is_need_range(&error) => None,
        Err(error) => return Err(error),
    };
    if head_magic.is_some_and(|magic| magic != CHUNK_MAGIC) {
        // Legacy (pre-2012) ND2 is a different container that does not carry
        // the chunk magic at all. Say so rather than calling the file invalid:
        // it is a real ND2, just one this decoder does not read.
        return Err(DecodeError::new(
            "This is a legacy (pre-2012) ND2 file; only modern chunk-based ND2 files are supported",
        ));
    }
    // The trailer is the 32-byte signature followed by the 8-byte map offset.
    let signature_start = size - 40;
    // Ask for a generous tail so a small chunk map comes along.
    let tail_start = size.saturating_sub(TAIL_FETCH);
    let tail = file.slice(tail_start, size - tail_start, "ND2")?;
    let trailer = &tail[signature_start - tail_start..];
    let signature = String::from_utf8_lossy(&trailer[..MAP_SIGNATURE.len()]);
    if signature != MAP_SIGNATURE {
        if head_magic.is_none() && u32_at(file, 0, 4)? != CHUNK_MAGIC {
            return Err(DecodeError::new(
                "This is a legacy (pre-2012) ND2 file; only modern chunk-based ND2 files are supported",
            ));
        }
        return Err(DecodeError::new(
            "ND2 file has no chunk map; only modern (Ver3.0+) ND2 files are supported",
        ));
    }
    let map_position = u64_at(file, size - 8, 8)?;
    // The chunk map is the last chunk: request everything from it to the end.
    let map_want = size.saturating_sub(usize::try_from(map_position).unwrap_or(size));
    let map_bytes = chunk_payload(file, map_position, map_want)?;
    let chunks = parse_chunk_map(map_bytes);
    if chunks.is_empty() {
        return Err(DecodeError::new("ND2 chunk map is empty"));
    }

    let options = parse_options(options_json);

    // --- Geometry --------------------------------------------------------
    let attributes_chunk = find_chunk(&chunks, "ImageAttributes")
        .ok_or_else(|| DecodeError::new("ND2 file has no image attributes chunk"))?;
    // The metadata chunks are independent of each other: request them together
    // before anything that depends on what they say.
    prefetch_metadata(
        file,
        &[
            Some(attributes_chunk),
            find_chunk(&chunks, "ImageMetadata"),
            find_chunk(&chunks, "ImageCalibration"),
            find_chunk(&chunks, "ImageMetadataSeq"),
        ],
    )?;
    let attributes_tree = metadata_tree(chunk_payload(
        file,
        attributes_chunk.offset,
        chunk_want(attributes_chunk),
    )?);
    let attributes = unwrap_root(&attributes_tree, "SLxImageAttributes");

    let width = attributes
        .get("uiWidth")
        .and_then(Lv::as_i64)
        .filter(|v| *v > 0)
        .ok_or_else(|| DecodeError::new("ND2 frame has no width"))? as usize;
    let height = attributes
        .get("uiHeight")
        .and_then(Lv::as_i64)
        .filter(|v| *v > 0)
        .ok_or_else(|| DecodeError::new("ND2 frame has no height"))? as usize;
    let channels = attributes
        .get("uiComp")
        .and_then(Lv::as_i64)
        .filter(|v| *v > 0)
        .unwrap_or(1) as usize;
    let bits = attributes
        .get("uiBpcInMemory")
        .and_then(Lv::as_i64)
        .unwrap_or(16) as u32;
    let pixel_type_id = attributes
        .get("ePixelType")
        .and_then(Lv::as_i64)
        .unwrap_or(1);
    let kind = pixel_type(bits, pixel_type_id).ok_or_else(|| {
        DecodeError::new(format!(
            "Unsupported ND2 pixel layout: {} bits, pixel type {}",
            bits, pixel_type_id
        ))
    })?;

    let compression = attributes.get("eCompression").and_then(Lv::as_i64);
    // 2 means "no compression". Files written without the field at all are
    // uncompressed too, which is why only an explicit 0/1 is refused.
    if let Some(mode) = compression {
        if mode == 0 || mode == 1 {
            let name = if mode == 0 { "lossless" } else { "lossy" };
            return Err(DecodeError::new(format!(
                "Compressed ND2 is not supported yet ({} compression); only uncompressed frames decode",
                name
            )));
        }
    }

    // `uiWidthBytes` is the stored row stride and may exceed the packed row
    // width. Trusting the packed width where padding exists shears the image,
    // so the declared stride wins whenever it is at least the packed size.
    let packed_row = mul(mul(width, channels)?, kind.bytes_per_sample)?;
    let declared_stride = attributes
        .get("uiWidthBytes")
        .and_then(Lv::as_i64)
        .filter(|v| *v > 0)
        .map(|v| v as usize)
        .unwrap_or(0);
    let row_stride = if declared_stride >= packed_row {
        declared_stride
    } else {
        packed_row
    };

    // --- Frames ----------------------------------------------------------
    let mut frames: Vec<(usize, u64, u64)> = Vec::new();
    for (name, chunk) in &chunks {
        let Some(rest) = name.strip_prefix("ImageDataSeq|") else {
            continue;
        };
        let Ok(index) = rest.trim_end_matches('!').parse::<usize>() else {
            continue;
        };
        frames.push((index, chunk.offset, chunk.length));
    }
    if frames.is_empty() {
        return Err(DecodeError::new("ND2 file contains no image frames"));
    }
    frames.sort_by_key(|(index, _, _)| *index);
    let stored_frame_count = frames.len();

    // `uiSequenceCount` describes the acquisition that was planned. A run
    // stopped mid-loop leaves extra frames on disk beyond it; an aborted run
    // leaves fewer. Navigation uses whichever is smaller so that every
    // addressable coordinate corresponds to a frame that actually exists.
    let planned_count = attributes
        .get("uiSequenceCount")
        .and_then(Lv::as_i64)
        .filter(|v| *v > 0)
        .map(|v| v as usize)
        .unwrap_or(stored_frame_count);
    let frame_count = planned_count.min(stored_frame_count);

    let experiment =
        optional_payload(file, find_chunk(&chunks, "ImageMetadata"))?.map(metadata_tree);
    let axes = match &experiment {
        Some(tree) => axis_model(tree, frame_count),
        None => Vec::new(),
    };

    // Resolve the requested coordinate on every axis, then flatten to a frame.
    let mut selected: Vec<usize> = Vec::new();
    let mut frame_index = 0usize;
    for axis in &axes {
        let requested = options
            .indices
            .get(&axis.name)
            .copied()
            .filter(|v| v.is_finite())
            .map(|v| v.round() as i64)
            .unwrap_or(0);
        let clamped = requested.max(0).min(axis.size as i64 - 1) as usize;
        selected.push(clamped);
        frame_index = frame_index.saturating_add(clamped.saturating_mul(axis.stride));
    }
    let frame_index = frame_index.min(frame_count.saturating_sub(1));

    // The channel axis is not an experiment loop: channels are interleaved
    // inside one frame, so it selects a component rather than a frame.
    let requested_channel = options
        .indices
        .get("C")
        .copied()
        .filter(|v| v.is_finite())
        .map(|v| v.round() as i64)
        .unwrap_or(0)
        .max(0)
        .min(channels as i64 - 1) as usize;

    let (_, frame_offset, frame_length) = frames
        .get(frame_index)
        .copied()
        .ok_or_else(|| DecodeError::new("ND2 frame index is out of range"))?;
    let frame_chunk = Chunk {
        offset: frame_offset,
        length: frame_length,
    };
    let payload = chunk_payload(file, frame_offset, chunk_want(&frame_chunk))?;
    // Every frame payload opens with an f64 acquisition timestamp.
    let pixels = get_slice(payload, 8, payload.len().saturating_sub(8), "ND2 frame")?;
    let timestamp_ms = f64_le(payload, 0).unwrap_or(f64::NAN);

    // An 8-bit three-component frame comes from a colour camera and is a real
    // RGB image (brightfield, H&E histology); it is emitted as three channels
    // so it displays in colour. Anything else with multiple components is
    // fluorescence, where each channel is an independent measurement: those
    // are emitted one plane at a time behind a `C` selector, because
    // compositing them into RGB would misreport values in the pixel inspector.
    let is_rgb = channels == 3 && kind.bits_per_sample == 8;
    let output_channels = if is_rgb { 3 } else { 1 };

    let mut out = vec![0f32; mul(mul(width, height)?, output_channels)?];
    for row in 0..height {
        let row_start = mul(row, row_stride)?;
        let target_row = mul(mul(row, width)?, output_channels)?;
        for column in 0..width {
            let pixel_start = add(
                row_start,
                mul(mul(column, channels)?, kind.bytes_per_sample)?,
            )?;
            if is_rgb {
                for channel in 0..3 {
                    let offset = add(pixel_start, mul(channel, kind.bytes_per_sample)?)?;
                    out[target_row + column * 3 + channel] = read_sample(pixels, &kind, offset)?;
                }
            } else {
                let offset = add(pixel_start, mul(requested_channel, kind.bytes_per_sample)?)?;
                out[target_row + column] = read_sample(pixels, &kind, offset)?;
            }
        }
    }

    // --- Metadata --------------------------------------------------------
    let calibration =
        optional_payload(file, find_chunk(&chunks, "ImageCalibration"))?.map(metadata_tree);
    let micrometres_per_pixel = calibration
        .as_ref()
        .and_then(|tree| unwrap_root(tree, "SLxCalibration").get("dCalibration"))
        .and_then(Lv::as_f64)
        .filter(|v| v.is_finite() && *v > 0.0);
    let objective = calibration
        .as_ref()
        .and_then(|tree| unwrap_root(tree, "SLxCalibration").get("sObjective"))
        .and_then(Lv::as_str)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let channel_names = channel_names(&chunks, file, channels)?;

    // `labels` present => the options are NAMED and the viewer renders a
    // choice; absent => a homogeneous axis and it renders a scrub. Every
    // decoder answers this the same way, so the viewer needs no format rules.
    let mut selectors: Vec<(String, usize, usize, Option<Vec<String>>)> = axes
        .iter()
        .zip(selected.iter())
        .filter(|(axis, _)| axis.size > 1)
        .map(|(axis, value)| (axis.name.clone(), axis.size, *value, None))
        .collect();
    if channels > 1 && !is_rgb {
        let labels = if channel_names.len() == channels {
            Some(channel_names.clone())
        } else {
            None
        };
        selectors.push(("C".to_string(), channels, requested_channel, labels));
    }

    let mut fields: Vec<(String, JsonValue)> = Vec::new();
    fields.push(("format".to_string(), JsonValue::Str("ND2".to_string())));
    fields.push((
        "pixelTypeName".to_string(),
        JsonValue::Str(kind.name.to_string()),
    ));
    fields.push(("frameCount".to_string(), JsonValue::Num(frame_count as f64)));
    // Surfaced rather than hidden: a run stopped mid-loop leaves frames on
    // disk that the dimension grid cannot address, and silently dropping them
    // would look like data loss.
    if stored_frame_count != frame_count {
        fields.push((
            "unaddressableFrames".to_string(),
            JsonValue::Num((stored_frame_count as f64) - (frame_count as f64)),
        ));
    }
    if timestamp_ms.is_finite() {
        fields.push(("frameTimeMs".to_string(), JsonValue::Num(timestamp_ms)));
    }
    push_opt(
        &mut fields,
        "scalingXUm",
        micrometres_per_pixel.map(JsonValue::Num),
    );
    push_opt(
        &mut fields,
        "scalingYUm",
        micrometres_per_pixel.map(JsonValue::Num),
    );
    push_opt(&mut fields, "objective", objective.map(JsonValue::Str));
    if !channel_names.is_empty() {
        fields.push((
            "channelNames".to_string(),
            JsonValue::Arr(
                channel_names
                    .iter()
                    .map(|name| JsonValue::Str(name.clone()))
                    .collect(),
            ),
        ));
    }
    fields.push((
        "selectors".to_string(),
        JsonValue::Arr(
            selectors
                .iter()
                .map(|(name, size, value, labels)| {
                    let mut entry = vec![
                        ("name".to_string(), JsonValue::Str(name.clone())),
                        ("size".to_string(), JsonValue::Num(*size as f64)),
                        ("value".to_string(), JsonValue::Num(*value as f64)),
                    ];
                    if let Some(labels) = labels {
                        entry.push((
                            "labels".to_string(),
                            JsonValue::Arr(
                                labels.iter().map(|l| JsonValue::Str(l.clone())).collect(),
                            ),
                        ));
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
                .map(|(name, _, value, _)| (name.clone(), JsonValue::Num(*value as f64)))
                .collect(),
        ),
    ));
    let metadata_json = to_json_string(&JsonValue::Obj(fields));

    Ok(ScientificParsed {
        width: width as u32,
        height: height as u32,
        channels: output_channels as u32,
        bits_per_sample: kind.bits_per_sample,
        sample_format: kind.sample_format,
        type_min: kind.type_min,
        type_max: kind.type_max,
        source_numeric_type: kind.source_numeric_type.to_string(),
        metadata_json,
        data: out,
    })
}

/// Channel names from `ImageMetadataSeqLV|0`, where each plane's descriptor
/// carries the probe or filter name. Falls back to positional names so the
/// selector always has a label.
fn channel_names(
    chunks: &HashMap<String, Chunk>,
    file: &SparseFile<'_>,
    channels: usize,
) -> Result<Vec<String>, DecodeError> {
    let mut names: Vec<String> = Vec::new();
    {
        if let Some(payload) = optional_payload(file, find_chunk(chunks, "ImageMetadataSeq"))? {
            let tree = metadata_tree(payload);
            let root = unwrap_root(&tree, "SLxPictureMetadata");
            if let Some(Lv::Map(planes)) = root.path(&["sPicturePlanes", "sPlaneNew"]) {
                for (_, plane) in planes {
                    let name = plane
                        .get("sDescription")
                        .and_then(Lv::as_str)
                        .filter(|s| !s.is_empty())
                        .or_else(|| plane.get("sOpticalConfigName").and_then(Lv::as_str))
                        .filter(|s| !s.is_empty());
                    match name {
                        Some(text) => names.push(text.to_string()),
                        // An unnamed plane makes the whole set unnamed: a
                        // synthesized "Channel 2" is not a name.
                        None => return Ok(Vec::new()),
                    }
                }
            }
        }
    }
    names.truncate(channels);
    // Partial naming is no naming: report all or nothing.
    if names.len() != channels {
        return Ok(Vec::new());
    }
    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    fn collect_nd2(dir: &Path, out: &mut Vec<PathBuf>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_nd2(&path, out);
            } else if path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("nd2"))
            {
                out.push(path);
            }
        }
    }

    /// Parse `[need-range:OFFSET:LENGTH]` out of a request error.
    fn parse_need(error: &DecodeError) -> (usize, usize) {
        let text = error.to_string();
        let inner = text
            .strip_prefix("[need-range:")
            .and_then(|rest| rest.split(']').next())
            .expect("need-range marker");
        let (offset, length) = inner.split_once(':').expect("offset:length");
        (offset.parse().unwrap(), length.parse().unwrap())
    }

    /// The viewer's loop: decode, on a missing range read exactly that range
    /// from the real file, retry. Returns the result, the number of decode
    /// calls and the bytes fetched.
    fn run_sparse(
        file: &[u8],
        options: &str,
    ) -> (Result<ScientificParsed, DecodeError>, usize, usize) {
        let mut ranges: Vec<(usize, usize)> = Vec::new();
        let mut fetched = 0usize;
        for iteration in 1..=64 {
            let pieces = ranges
                .iter()
                .map(|&(offset, length)| (offset, &file[offset..offset + length]))
                .collect();
            let result = decode_nd2_sparse(&SparseFile::new(file.len(), pieces), options);
            match result {
                Err(ref error) if is_need_range(error) => {
                    let (offset, length) = parse_need(error);
                    assert!(
                        offset + length <= file.len() && length > 0,
                        "bad range {offset}:{length}"
                    );
                    if std::env::var("ND2_TRACE").is_ok() {
                        eprintln!("  need {offset}:{length}");
                    }
                    ranges.push((offset, length));
                    fetched += length;
                }
                other => return (other, iteration, fetched),
            }
        }
        panic!("decode_nd2_sparse did not settle in 64 iterations");
    }

    fn assert_same(
        label: &str,
        whole: &Result<ScientificParsed, DecodeError>,
        sparse: &Result<ScientificParsed, DecodeError>,
    ) {
        match (whole, sparse) {
            (Ok(a), Ok(b)) => {
                assert_eq!(
                    (a.width, a.height, a.channels),
                    (b.width, b.height, b.channels),
                    "{label}"
                );
                assert_eq!(a.bits_per_sample, b.bits_per_sample, "{label}");
                assert_eq!(a.sample_format, b.sample_format, "{label}");
                assert_eq!(a.type_min.to_bits(), b.type_min.to_bits(), "{label}");
                assert_eq!(a.type_max.to_bits(), b.type_max.to_bits(), "{label}");
                assert_eq!(a.source_numeric_type, b.source_numeric_type, "{label}");
                assert_eq!(a.metadata_json, b.metadata_json, "{label}");
                assert_eq!(a.data.len(), b.data.len(), "{label}");
                assert!(
                    a.data
                        .iter()
                        .zip(&b.data)
                        .all(|(x, y)| x.to_bits() == y.to_bits()),
                    "{label}: pixel data differs"
                );
            }
            (Err(a), Err(b)) => assert_eq!(a.to_string(), b.to_string(), "{label}"),
            _ => panic!("{label}: whole-file and sparse results disagree"),
        }
    }

    /// Last value of each selector axis, as separate option sets.
    fn plane_options(metadata_json: &str) -> Vec<String> {
        let mut options = vec!["{}".to_string()];
        let Some(start) = metadata_json.find("\"selectors\":[") else {
            return options;
        };
        let rest = &metadata_json[start..];
        let end = rest.find("],\"selectedIndices\"").unwrap_or(rest.len());
        let mut cursor = &rest[..end];
        while let Some(at) = cursor.find("\"name\":\"") {
            cursor = &cursor[at + 8..];
            let name = cursor.split('"').next().unwrap_or("").to_string();
            let Some(size_at) = cursor.find("\"size\":") else {
                break;
            };
            let size: usize = cursor[size_at + 7..]
                .split(|c: char| !c.is_ascii_digit())
                .next()
                .and_then(|n| n.parse().ok())
                .unwrap_or(1);
            if size > 1 {
                options.push(format!("{{\"indices\":{{\"{}\":{}}}}}", name, size - 1));
            }
        }
        options
    }

    // The percentage in the report line is display-only; file sizes are far below f64's 52-bit mantissa.
    #[allow(clippy::cast_precision_loss)]
    #[test]
    fn sparse_decode_matches_whole_file_on_corpus() {
        let Ok(corpus) = std::env::var("ND2_CORPUS") else {
            eprintln!("ND2_CORPUS not set; skipping the ranged ND2 corpus test");
            return;
        };
        let mut files = Vec::new();
        collect_nd2(Path::new(&corpus), &mut files);
        files.sort();
        assert!(!files.is_empty(), "no .nd2 files under {corpus}");
        for path in files {
            let file = std::fs::read(&path).unwrap();
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            let default_whole = decode_nd2_impl(&file, "{}");
            let options = match &default_whole {
                Ok(parsed) => plane_options(&parsed.metadata_json),
                Err(_) => vec!["{}".to_string()],
            };
            for option in options {
                let whole = decode_nd2_impl(&file, &option);
                let (sparse, iterations, fetched) = run_sparse(&file, &option);
                let label = format!("{name} {option}");
                assert_same(&label, &whole, &sparse);
                println!(
                    "{label}: {iterations} iterations, fetched {fetched} of {} bytes ({:.2}%){}",
                    file.len(),
                    100.0 * fetched as f64 / file.len() as f64,
                    if whole.is_err() { " [error case]" } else { "" }
                );
            }
        }
    }
}
