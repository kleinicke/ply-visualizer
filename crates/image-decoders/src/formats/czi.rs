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
//! Z/C/T/... coordinate, and blitting them into one raster. Uncompressed,
//! JPEG, LZW and both Zstd forms decode in the core module; JPEG XR routes to
//! the lazy heavy-codec module. Pyramid (subsampled) subblocks are skipped so
//! the full-resolution plane is always what gets assembled.
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
use std::io::Cursor;

/// Axis order used for the plane selector UI; unknown axes are appended.
const CZI_AXIS_ORDER: [&str; 10] = ["S", "I", "V", "H", "R", "T", "C", "Z", "B", "M"];

fn compression_name(id: i32) -> String {
    match id {
        1 => "JPEG".to_string(),
        2 => "LZW".to_string(),
        4 => "JPEG XR".to_string(),
        5 => "Zstd-0".to_string(),
        6 => "Zstd-1".to_string(),
        7 => "CHUNKED".to_string(),
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
        other => Err(DecodeError::new(format!(
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
    usize::try_from(v).map_err(|_| DecodeError::new(format!("CZI: {} out of range", context)))
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
        return Err(DecodeError::new(format!(
            "CZI segment out of range at {}",
            position
        )));
    }
    let pos = i64_to_usize(position, "segment position")?;
    let end = pos
        .checked_add(32)
        .ok_or_else(|| DecodeError::new("CZI: offset overflow"))?;
    if end > data.len() {
        return Err(DecodeError::new(format!(
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
        return Err(DecodeError::new(format!(
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

/// Decompress one CZI subblock.
///
/// Zstd-0 (compression 5) is a bare zstd frame of the tile's bytes. Zstd-1
/// (compression 6) puts a small header in front: one byte giving the header's
/// own size, and when that size is 3, a chunk type and a flags byte whose bit
/// 0 says the encoder applied "hi-lo byte packing" — every sample's low byte
/// written first for the WHOLE tile, then every high byte. That has to be
/// interleaved back before the samples mean anything.
struct DecodedCziSubblock {
    pixels: Vec<u8>,
    /// JPEG-family decoders normalize colour to RGB; raw CZI bytes use BGR.
    rgb_order: bool,
}

fn decode_czi_subblock(
    payload: &[u8],
    compression: i32,
    expected: usize,
    pixel_type: &PixelTypeInfo,
    width: usize,
    height: usize,
) -> Result<DecodedCziSubblock, DecodeError> {
    use std::io::Read;

    if compression == 1 {
        if pixel_type.bytes_per_channel != 1 || !matches!(pixel_type.channels, 1 | 3) {
            return Err(DecodeError::new(format!(
                "CZI JPEG subblocks require Gray8 or Bgr24 pixels, found {}",
                pixel_type.name
            )));
        }
        let mut image = crate::decode_jpeg_with_channels(payload, pixel_type.channels)?;
        if image.width() as usize != width
            || image.height() as usize != height
            || image.channels() != pixel_type.channels
        {
            return Err(DecodeError::new(format!(
                "CZI JPEG subblock decoded as {}x{}x{}, expected {}x{}x{}",
                image.width(),
                image.height(),
                image.channels(),
                width,
                height,
                pixel_type.channels
            )));
        }
        let pixels = image.take_data_as_u8();
        if pixels.len() < expected {
            return Err(DecodeError::new(format!(
                "CZI JPEG subblock holds {} bytes, expected {}",
                pixels.len(),
                expected
            )));
        }
        return Ok(DecodedCziSubblock {
            pixels,
            rgb_order: pixel_type.channels >= 3,
        });
    }

    if compression == 2 {
        return Ok(DecodedCziSubblock {
            pixels: super::compression::decode_tiff_lzw(payload, expected, "CZI subblock")?,
            rgb_order: false,
        });
    }

    if compression == 4 {
        #[cfg(not(feature = "codec-jpegxr"))]
        return Err(super::external_codec::needed("JPEG XR", "CZI subblock"));

        #[cfg(feature = "codec-jpegxr")]
        {
            let decoded = super::jpegxr::decode_jpegxr_pixels(payload, "CZI subblock")?;
            let expected_sample_format = if pixel_type.sample_format == 3 {
                jpegxr::SampleFormat::FloatingPoint
            } else if pixel_type.sample_format == 1 {
                jpegxr::SampleFormat::UnsignedInteger
            } else {
                jpegxr::SampleFormat::Other(pixel_type.sample_format)
            };
            if decoded.width as usize != width
                || decoded.height as usize != height
                || decoded.channels != pixel_type.channels
                || decoded.bits_per_sample != pixel_type.bits_per_sample
                || decoded.sample_format != expected_sample_format
            {
                return Err(DecodeError::new(format!(
                    "CZI JPEG XR subblock decoded as {}x{}x{} {:?}/{}-bit, expected {}x{}x{} {:?}/{}-bit",
                    decoded.width,
                    decoded.height,
                    decoded.channels,
                    decoded.sample_format,
                    decoded.bits_per_sample,
                    width,
                    height,
                    pixel_type.channels,
                    expected_sample_format,
                    pixel_type.bits_per_sample
                )));
            }
            if decoded.pixels.len() < expected {
                return Err(DecodeError::new(format!(
                    "CZI JPEG XR subblock holds {} bytes, expected {}",
                    decoded.pixels.len(),
                    expected
                )));
            }
            return Ok(DecodedCziSubblock {
                pixels: decoded.pixels,
                rgb_order: decoded.interpretation == jpegxr::PixelInterpretation::Rgb,
            });
        }
    }

    if compression == 7 {
        return Ok(DecodedCziSubblock {
            pixels: super::compression::decode_czi_chunked(
                payload,
                expected,
                pixel_type.bytes_per_channel as usize,
            )?,
            rgb_order: false,
        });
    }

    let bytes_per_channel = pixel_type.bytes_per_channel as usize;
    let (frame, hi_lo_packed) = match compression {
        5 => (payload, false),
        6 => {
            let header_size = *payload
                .first()
                .ok_or_else(|| DecodeError::new("CZI Zstd-1 subblock is empty"))?
                as usize;
            if header_size == 0 || header_size > payload.len() {
                return Err(DecodeError::new("CZI Zstd-1 header size is out of range"));
            }
            // Header size 1 is the header alone: no flags, nothing applied.
            let packed = header_size >= 3 && (payload[2] & 0x01) != 0;
            (&payload[header_size..], packed)
        }
        other => {
            return Err(DecodeError::new(format!(
                "CZI subblock compression {} is not supported",
                other
            )))
        }
    };

    let mut out = Vec::with_capacity(expected);
    let mut decoder = ruzstd::decoding::StreamingDecoder::new(Cursor::new(frame))
        .map_err(|e| DecodeError::new(format!("CZI Zstd decoder init: {:?}", e)))?;
    decoder
        .read_to_end(&mut out)
        .map_err(|e| DecodeError::new(format!("CZI Zstd decode failed: {:?}", e)))?;

    if hi_lo_packed {
        if bytes_per_channel != 2 {
            return Err(DecodeError::new(format!(
                "CZI hi-lo byte packing is defined for 16-bit samples, not {}-byte ones",
                bytes_per_channel
            )));
        }
        let half = out.len() / 2;
        let mut interleaved = Vec::with_capacity(out.len());
        for index in 0..half {
            interleaved.push(out[index]);
            interleaved.push(out[half + index]);
        }
        out = interleaved;
    }
    Ok(DecodedCziSubblock {
        pixels: out,
        rgb_order: false,
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
    while position >= 0 && position + 32 <= data.len() as i64 {
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

/// A count or position as a JSON number. JSON numbers are f64 by design and
/// file positions and pixel counts stay far below 2^53.
#[allow(clippy::cast_precision_loss)]
fn num_usize(v: usize) -> JsonValue {
    JsonValue::Num(v as f64)
}

/// Like [`num_usize`], for signed positions and sizes.
#[allow(clippy::cast_precision_loss)]
fn num_i64(v: i64) -> JsonValue {
    JsonValue::Num(v as f64)
}

/// A JSON number as `i64`. The float-to-int cast saturates and maps NaN to 0,
/// which is the intended handling of out-of-range option values.
#[allow(clippy::cast_possible_truncation)]
fn f64_to_i64(v: f64) -> i64 {
    v as i64
}

/// A JSON number as `usize`; negative values and NaN become 0, oversized ones
/// saturate (the float-to-int cast semantics are the intended handling).
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn f64_to_usize(v: f64) -> usize {
    v as usize
}

/// A JSON number as `u32`, with the same saturating semantics.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn f64_to_u32(v: f64) -> u32 {
    v as u32
}

/// A `usize` as `i64`, saturating. Every caller passes a size that came from an
/// `i64` extent or an in-memory length, so saturation is unreachable.
fn to_i64(v: usize) -> i64 {
    i64::try_from(v).unwrap_or(i64::MAX)
}

/// An `i64` known to be non-negative and in range as `usize` (0 otherwise).
fn non_negative_usize(v: i64) -> usize {
    usize::try_from(v).unwrap_or(0)
}

/// The subblocks and geometry of one plane (a Z/C/T/... coordinate).
struct CziPlane {
    pixel_type: PixelTypeInfo,
    pixel_type_id: i32,
    axis_order: Vec<String>,
    axes: HashMap<String, (i64, i64)>,
    requested: HashMap<String, i64>,
    /// Full-resolution subblocks of this plane, in directory order.
    full: Vec<usize>,
    /// Stored pyramid subblocks of this plane by reduction factor.
    levels: Vec<(u32, Vec<usize>)>,
    full_entry_count: usize,
    min_x: i64,
    min_y: i64,
    width: usize,
    height: usize,
}

/// Reduction factor of a subblock: logical size over stored size.
fn entry_factor(entry: &CziDirectoryEntry) -> Option<u32> {
    let x = find_dim(&entry.dimensions, "X")?;
    let y = find_dim(&entry.dimensions, "Y")?;
    if x.size == x.stored_size && y.size == y.stored_size {
        return Some(1);
    }
    if x.stored_size <= 0 || x.size <= 0 {
        return None;
    }
    let factor = (f64::from(x.size) / f64::from(x.stored_size)).round();
    if (2.0..=65536.0).contains(&factor) {
        Some(f64_to_u32(factor))
    } else {
        None
    }
}

fn entry_matches(
    entry: &CziDirectoryEntry,
    axis_order: &[String],
    requested: &HashMap<String, i64>,
) -> bool {
    axis_order.iter().all(|name| {
        let value = requested[name];
        match find_dim(&entry.dimensions, name) {
            None => true,
            Some(dim) => {
                let start = i64::from(dim.start);
                let end = start + i64::from(dim.size).max(1);
                value >= start && value < end
            }
        }
    })
}

/// Axis names and (min, max) extents across the full-resolution subblocks,
/// spatial axes and the mosaic axis excluded. Order matches TS object
/// insertion order (first-seen axis name wins position).
fn plane_axes(
    all: &[CziDirectoryEntry],
    full_entries: &[usize],
) -> (Vec<String>, HashMap<String, (i64, i64)>) {
    let mut axis_order: Vec<String> = Vec::new();
    let mut axes: HashMap<String, (i64, i64)> = HashMap::new(); // name -> (min, max)
    for &index in full_entries {
        for (name, dim) in &all[index].dimensions {
            if name == "X" || name == "Y" {
                continue;
            }
            let lo = i64::from(dim.start);
            let hi = i64::from(dim.start) + i64::from(dim.size).max(1) - 1;
            if let Some(range) = axes.get_mut(name) {
                range.0 = range.0.min(lo);
                range.1 = range.1.max(hi);
            } else {
                axis_order.push(name.clone());
                axes.insert(name.clone(), (lo, hi));
            }
        }
    }
    // Mosaic tiles share a coordinate, so M selects nothing the user cares about.
    axes.remove("M");
    axis_order.retain(|n| n != "M");
    (axis_order, axes)
}

/// Top-left corner and size of the area the `full` subblocks cover.
fn plane_extent(
    all: &[CziDirectoryEntry],
    full: &[usize],
) -> Result<(i64, i64, usize, usize), DecodeError> {
    let mut min_x = i64::MAX;
    let mut min_y = i64::MAX;
    let mut max_x = i64::MIN;
    let mut max_y = i64::MIN;
    for &index in full {
        let entry = &all[index];
        // Guaranteed present: `entry_factor` requires X and Y.
        let x = find_dim(&entry.dimensions, "X")
            .ok_or_else(|| DecodeError::new("CZI subblock is missing the X dimension"))?;
        let y = find_dim(&entry.dimensions, "Y")
            .ok_or_else(|| DecodeError::new("CZI subblock is missing the Y dimension"))?;
        min_x = min_x.min(i64::from(x.start));
        min_y = min_y.min(i64::from(y.start));
        max_x = max_x.max(i64::from(x.start) + i64::from(x.size));
        max_y = max_y.max(i64::from(y.start) + i64::from(y.size));
    }
    let width_i64 = max_x - min_x;
    let height_i64 = max_y - min_y;
    if !(width_i64 > 0 && height_i64 > 0) {
        return Err(DecodeError::new("CZI plane has an empty extent"));
    }
    Ok((
        min_x,
        min_y,
        i64_to_usize(width_i64, "plane width")?,
        i64_to_usize(height_i64, "plane height")?,
    ))
}

/// Choose the plane `options` asks for. Mirrors the plane selection of TS
/// `parseCzi()`; pyramid subblocks are collected per factor beside it.
fn select_plane(
    all: &[CziDirectoryEntry],
    options: &DecodeOptions,
) -> Result<CziPlane, DecodeError> {
    // Pyramid levels store a downscaled copy of the same coordinate; the
    // plane's axes and extent come from the full-resolution subblocks.
    let full_entries: Vec<usize> = (0..all.len())
        .filter(|&index| entry_factor(&all[index]) == Some(1))
        .collect();
    if full_entries.is_empty() {
        return Err(DecodeError::new(
            "CZI file contains no full-resolution subblocks",
        ));
    }

    let base_pixel_type_id = all[full_entries[0]].pixel_type;
    let pixel_type = pixel_type_info(base_pixel_type_id).ok_or_else(|| {
        DecodeError::new(format!("Unsupported CZI pixel type: {base_pixel_type_id}"))
    })?;

    let (axis_order, axes) = plane_axes(all, &full_entries);

    let mut requested: HashMap<String, i64> = HashMap::new();
    for name in &axis_order {
        let (min, max) = axes[name];
        let wanted = options.indices.get(name).copied().unwrap_or(f64::NAN);
        let offset = if wanted.is_finite() {
            f64_to_i64(js_round(wanted))
        } else {
            0
        };
        let value = (min + offset).max(min).min(max);
        requested.insert(name.clone(), value);
    }

    let full: Vec<usize> = full_entries
        .iter()
        .copied()
        .filter(|&index| entry_matches(&all[index], &axis_order, &requested))
        .collect();
    if full.is_empty() {
        return Err(DecodeError::new(
            "No CZI subblock matches the requested plane",
        ));
    }

    let mut levels: Vec<(u32, Vec<usize>)> = Vec::new();
    for (index, entry) in all.iter().enumerate() {
        let Some(factor) = entry_factor(entry) else {
            continue;
        };
        if factor < 2
            || entry.pixel_type != base_pixel_type_id
            || !entry_matches(entry, &axis_order, &requested)
        {
            continue;
        }
        match levels.iter_mut().find(|(f, _)| *f == factor) {
            Some((_, list)) => list.push(index),
            None => levels.push((factor, vec![index])),
        }
    }
    levels.sort_by_key(|(factor, _)| *factor);

    let (min_x, min_y, width, height) = plane_extent(all, &full)?;
    Ok(CziPlane {
        pixel_type,
        pixel_type_id: base_pixel_type_id,
        axis_order,
        axes,
        requested,
        full,
        levels,
        full_entry_count: full_entries.len(),
        min_x,
        min_y,
        width,
        height,
    })
}

/// Reject subblocks this build cannot decode before any raster is allocated.
/// A large mosaic of compressed subblocks would otherwise try to reserve the
/// whole plane first, and on wasm32 (32-bit usize) that allocation aborts the
/// module with a capacity overflow panic instead of returning the
/// "unsupported codec" message the native build produces. Same inputs must
/// give the same answer on both targets.
fn validate_codecs(
    all: &[CziDirectoryEntry],
    tiles: &[usize],
    pixel_type_id: i32,
) -> Result<(), DecodeError> {
    for &index in tiles {
        let entry = &all[index];
        if entry.compression == 4 {
            #[cfg(not(feature = "codec-jpegxr"))]
            return Err(super::external_codec::needed("JPEG XR", "CZI subblock"));
        } else if !matches!(entry.compression, 0 | 1 | 2 | 5 | 6 | 7) {
            let codec = compression_name(entry.compression);
            return Err(DecodeError::new(format!(
                "CZI subblocks compressed with {codec} are not supported; uncompressed, JPEG, \
                 LZW, Zstd-0/Zstd-1 and CHUNKED subblocks decode"
            )));
        }
        if entry.pixel_type != pixel_type_id {
            return Err(DecodeError::new("Mixed pixel types in one CZI plane"));
        }
    }
    Ok(())
}

/// A rectangle of the plane, in full-resolution pixels from the plane's
/// top-left corner, sampled every `factor` pixels: output pixel (ox, oy)
/// shows plane pixel (x + ox * factor, y + oy * factor).
#[derive(Clone, Copy)]
struct CziRegion {
    x: i64,
    y: i64,
    width: usize,
    height: usize,
    factor: u32,
}

impl CziRegion {
    fn output_size(&self) -> (usize, usize) {
        let f = self.factor as usize;
        (self.width.div_ceil(f), self.height.div_ceil(f))
    }
}

/// Subblocks of `tiles` whose logical rectangle meets `region`.
fn tiles_in_region(
    all: &[CziDirectoryEntry],
    plane: &CziPlane,
    tiles: &[usize],
    region: &CziRegion,
) -> Vec<usize> {
    let x0 = plane.min_x + region.x;
    let y0 = plane.min_y + region.y;
    let x1 = x0 + to_i64(region.width);
    let y1 = y0 + to_i64(region.height);
    tiles
        .iter()
        .copied()
        .filter(|&index| {
            let entry = &all[index];
            match (
                find_dim(&entry.dimensions, "X"),
                find_dim(&entry.dimensions, "Y"),
            ) {
                (Some(x), Some(y)) => {
                    let sx = i64::from(x.start);
                    let sy = i64::from(y.start);
                    sx < x1 && sx + i64::from(x.size) > x0 && sy < y1 && sy + i64::from(y.size) > y0
                }
                _ => false,
            }
        })
        .collect()
}

/// The stored level a region at `factor` reads: the coarsest stored factor
/// that is not coarser than asked for (full resolution when none is).
fn source_level(plane: &CziPlane, factor: u32) -> (u32, &[usize]) {
    let mut best: (u32, &[usize]) = (1, &plane.full);
    for (level, tiles) in &plane.levels {
        if *level <= factor && *level > best.0 {
            best = (*level, tiles);
        }
    }
    best
}

/// Where a subblock's pixels sit in its segment bytes, and their stored size.
struct SubblockLayout<'a> {
    segment_data_start: usize,
    pixels_start: usize,
    dim_x: &'a CziDimension,
    dim_y: &'a CziDimension,
    tile_width: usize,
    tile_height: usize,
    stride: usize,
    total_needed: usize,
}

/// Parse the header of the subblock segment at the start of `data`.
fn locate_subblock<'a>(
    entry: &'a CziDirectoryEntry,
    data: &[u8],
    pixel_type: &PixelTypeInfo,
) -> Result<SubblockLayout<'a>, DecodeError> {
    let channels = pixel_type.channels as usize;
    let bytes_per_channel = pixel_type.bytes_per_channel as usize;
    let segment = czi_segment(data, 0)?;
    if segment.id != "ZISRAWSUBBLOCK" {
        return Err(DecodeError::new(format!(
            "Expected ZISRAWSUBBLOCK at {}, found \"{}\"",
            entry.file_position, segment.id
        )));
    }
    let metadata_size = i32_le(data, segment.data_start)?;
    let inline_entry = czi_directory_entry(data, add(segment.data_start, 16)?)?;
    // The fixed part of a subblock header is padded to at least 256 bytes.
    let fixed_size = add(16, inline_entry.byte_length)?.max(256);
    let meta_extra = usize::try_from(metadata_size).unwrap_or(0);
    let pixels_start = add(add(segment.data_start, fixed_size)?, meta_extra)?;

    let dim_x = find_dim(&entry.dimensions, "X")
        .ok_or_else(|| DecodeError::new("CZI subblock is missing the X dimension"))?;
    let dim_y = find_dim(&entry.dimensions, "Y")
        .ok_or_else(|| DecodeError::new("CZI subblock is missing the Y dimension"))?;
    let tile_width = usize::try_from(dim_x.stored_size.max(0)).unwrap_or(0);
    let tile_height = usize::try_from(dim_y.stored_size.max(0)).unwrap_or(0);
    let stride = mul(mul(tile_width, channels)?, bytes_per_channel)?;
    let total_needed = mul(stride, tile_height)?;
    // Only an UNCOMPRESSED subblock occupies its full pixel size in the
    // file; a compressed one is smaller, and its own range is checked
    // against the subblock's declared data size by the caller.
    if entry.compression == 0
        && pixels_start
            .checked_add(total_needed)
            .is_none_or(|end| end > data.len())
    {
        return Err(DecodeError::new("CZI subblock data is truncated"));
    }
    Ok(SubblockLayout {
        segment_data_start: segment.data_start,
        pixels_start,
        dim_x,
        dim_y,
        tile_width,
        tile_height,
        stride,
        total_needed,
    })
}

/// Decompress the payload of a compressed subblock whose header `layout` describes.
fn decompress_subblock(
    entry: &CziDirectoryEntry,
    data: &[u8],
    layout: &SubblockLayout<'_>,
    pixel_type: &PixelTypeInfo,
) -> Result<DecodedCziSubblock, DecodeError> {
    let data_size = i64_to_usize(
        i64_le(data, add(layout.segment_data_start, 8)?)?,
        "subblock size",
    )?;
    let end = add(layout.pixels_start, data_size)?;
    if end > data.len() {
        return Err(DecodeError::new("CZI subblock data is truncated"));
    }
    let decompressed = decode_czi_subblock(
        &data[layout.pixels_start..end],
        entry.compression,
        layout.total_needed,
        pixel_type,
        layout.tile_width,
        layout.tile_height,
    )?;
    if decompressed.pixels.len() < layout.total_needed {
        return Err(DecodeError::new(format!(
            "CZI subblock decompressed to {} bytes, expected {}",
            decompressed.pixels.len(),
            layout.total_needed
        )));
    }
    Ok(decompressed)
}

/// Decode `tiles` (each with its segment's bytes, starting at the segment
/// header) into `region`. Later subblocks overwrite earlier ones where mosaic
/// tiles overlap, as in the file's directory order. A subblock's stored pixel
/// for plane pixel X is `(X - start) * stored / size`, so full-resolution
/// tiles at factor 1 are copied 1:1 and pyramid tiles are sampled nearest.
fn compose_region(
    all: &[CziDirectoryEntry],
    plane: &CziPlane,
    tiles: &[(usize, &[u8])],
    region: &CziRegion,
) -> Result<Vec<f32>, DecodeError> {
    let pixel_type = &plane.pixel_type;
    let channels = pixel_type.channels as usize;
    let bytes_per_channel = pixel_type.bytes_per_channel as usize;
    let (out_width, out_height) = region.output_size();
    let factor = i64::from(region.factor);

    let pixel_count = mul(mul(out_width, out_height)?, channels)?;
    // `vec![0f32; n]` panics on a request the allocator cannot express; a plane
    // too large for the target must be a decode error, never an abort.
    let mut out: Vec<f32> = Vec::new();
    out.try_reserve_exact(pixel_count).map_err(|_| {
        DecodeError::new(format!(
            "CZI plane is too large to decode on this target: {out_width}x{out_height}x{channels} samples"
        ))
    })?;
    out.resize(pixel_count, 0.0);

    let origin_x = plane.min_x + region.x;
    let origin_y = plane.min_y + region.y;

    for &(index, data) in tiles {
        let entry = &all[index];
        let layout = locate_subblock(entry, data, pixel_type)?;
        let SubblockLayout {
            pixels_start,
            dim_x,
            dim_y,
            tile_width,
            tile_height,
            stride,
            ..
        } = layout;

        // The output pixels this subblock covers.
        let start_x = i64::from(dim_x.start);
        let start_y = i64::from(dim_y.start);
        let size_x = i64::from(dim_x.size).max(1);
        let size_y = i64::from(dim_y.size).max(1);
        let first = |start: i64, origin: i64| -> i64 {
            (start - origin).max(0).div_euclid(factor)
                + i64::from((start - origin).max(0) % factor != 0)
        };
        let first_col = first(start_x, origin_x);
        let first_row = first(start_y, origin_y);
        let end_col =
            ((start_x + size_x - origin_x + factor - 1).div_euclid(factor)).min(to_i64(out_width));
        let end_row =
            ((start_y + size_y - origin_y + factor - 1).div_euclid(factor)).min(to_i64(out_height));
        if first_col >= end_col || first_row >= end_row || tile_width == 0 || tile_height == 0 {
            continue;
        }

        // A compressed subblock is decompressed into its own buffer; an
        // uncompressed one is read straight out of the file. Either way the
        // loop below sees `tile` starting at `tile_start`.
        let decompressed;
        let (tile, tile_start, tile_is_rgb) = if entry.compression == 0 {
            (data, pixels_start, false)
        } else {
            decompressed = decompress_subblock(entry, data, &layout, pixel_type)?;
            (
                decompressed.pixels.as_slice(),
                0usize,
                decompressed.rgb_order,
            )
        };

        let stored_x = to_i64(tile_width);
        let stored_y = to_i64(tile_height);
        for out_y in first_row..end_row {
            let plane_y = origin_y + out_y * factor;
            let row = non_negative_usize(
                ((plane_y - start_y) * stored_y / size_y).clamp(0, stored_y - 1),
            );
            let source_row = add(tile_start, mul(row, stride)?)?;
            let target_row = mul(mul(non_negative_usize(out_y), out_width)?, channels)?;
            for out_x in first_col..end_col {
                let plane_x = origin_x + out_x * factor;
                let col = non_negative_usize(
                    ((plane_x - start_x) * stored_x / size_x).clamp(0, stored_x - 1),
                );
                let source = add(source_row, mul(col, channels * bytes_per_channel)?)?;
                let target = add(target_row, non_negative_usize(out_x) * channels)?;
                for channel in 0..channels {
                    let sample_offset = add(source, mul(channel, bytes_per_channel)?)?;
                    let value = read_sample(tile, plane.pixel_type_id, sample_offset)?;
                    // BGR(A) types are stored channel-reversed for the colour triple.
                    let index = if pixel_type.bgr && !tile_is_rgb && channel < 3 {
                        2 - channel
                    } else {
                        channel
                    };
                    if let Some(slot) = out.get_mut(target + index) {
                        // Samples are held as f32 by design; f64 sources round.
                        #[allow(clippy::cast_possible_truncation)]
                        let sample = value as f32;
                        *slot = sample;
                    }
                }
            }
        }
    }
    Ok(out)
}

/// The plane's metadata JSON: XML fields plus the selector description.
fn plane_metadata(
    plane: &CziPlane,
    xml_metadata: Vec<(String, JsonValue)>,
    tile_count: usize,
) -> String {
    let axes = &plane.axes;
    let requested = &plane.requested;
    let selectors: Vec<(String, i64, i64)> = CZI_AXIS_ORDER
        .iter()
        .map(|s| (*s).to_owned())
        .chain(
            plane
                .axis_order
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
        .map_or(0, |(min, _)| requested.get("C").copied().unwrap_or(0) - min);
    let channel_names: Option<Vec<String>> = xml_metadata
        .iter()
        .find(|(k, _)| k == "channelNames")
        .and_then(|(_, v)| match v {
            JsonValue::Arr(items) => Some(
                items
                    .iter()
                    .filter_map(|i| i.as_str().map(str::to_owned))
                    .collect(),
            ),
            _ => None,
        });
    let channel_name = channel_names.as_ref().and_then(|names| {
        usize::try_from(channel_index)
            .ok()
            .and_then(|index| names.get(index).cloned())
    });

    let mut fields: Vec<(String, JsonValue)> = xml_metadata;
    fields.push(("format".to_string(), JsonValue::Str("CZI".to_string())));
    fields.push((
        "pixelTypeName".to_string(),
        JsonValue::Str(plane.pixel_type.name.to_string()),
    ));
    fields.push((
        "subBlockCount".to_string(),
        num_usize(plane.full_entry_count),
    ));
    fields.push(("tileCount".to_string(), num_usize(tile_count)));
    fields.push((
        "selectors".to_string(),
        JsonValue::Arr(
            selectors
                .iter()
                .map(|(name, size, value)| {
                    let mut entry = vec![
                        ("name".to_string(), JsonValue::Str(name.clone())),
                        ("size".to_string(), num_i64(*size)),
                        ("value".to_string(), num_i64(*value)),
                    ];
                    // A selector whose options the FILE names carries them here.
                    // The viewer has one rule — named options are a choice,
                    // unnamed ones are an axis — and no knowledge of formats, so
                    // every decoder must answer this question itself.
                    if name == "C" {
                        if let Some(names) = channel_names.as_ref() {
                            if usize::try_from(*size).is_ok_and(|size| names.len() == size) {
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
                .map(|(name, _, value)| (name.clone(), num_i64(*value)))
                .collect(),
        ),
    ));
    push_opt(&mut fields, "channelName", channel_name.map(JsonValue::Str));
    to_json_string(&JsonValue::Obj(fields))
}

fn parsed(
    plane: &CziPlane,
    width: usize,
    height: usize,
    metadata_json: String,
    data: Vec<f32>,
) -> Result<ScientificParsed, DecodeError> {
    let pixel_type = &plane.pixel_type;
    let too_large = || DecodeError::new("CZI: image dimension out of range");
    Ok(ScientificParsed {
        width: u32::try_from(width).map_err(|_| too_large())?,
        height: u32::try_from(height).map_err(|_| too_large())?,
        channels: pixel_type.channels,
        bits_per_sample: pixel_type.bits_per_sample,
        sample_format: pixel_type.sample_format,
        type_min: pixel_type.type_min,
        type_max: pixel_type.type_max,
        source_numeric_type: pixel_type.source_numeric_type.to_string(),
        metadata_json,
        data,
    })
}

/// XML metadata fields of a ZISRAWMETADATA segment (starting at its header).
fn metadata_fields(segment_bytes: &[u8]) -> Result<Vec<(String, JsonValue)>, DecodeError> {
    if segment_bytes.len() < 36 {
        return Ok(Vec::new());
    }
    let segment = czi_segment(segment_bytes, 0)?;
    if segment.id != "ZISRAWMETADATA" {
        return Ok(Vec::new());
    }
    let xml_size = i32_le(segment_bytes, segment.data_start)?;
    if xml_size <= 0 {
        return Ok(Vec::new());
    }
    // Fixed part of the metadata segment is 256 bytes; the XML follows.
    let start = add(segment.data_start, 256)?;
    if start >= segment_bytes.len() {
        return Ok(Vec::new());
    }
    let end = start
        .checked_add(usize::try_from(xml_size).unwrap_or(0))
        .unwrap_or(segment_bytes.len())
        .min(segment_bytes.len());
    let xml = String::from_utf8_lossy(&segment_bytes[start..end]);
    Ok(czi_xml_metadata(&xml))
}

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
    if metadata_position > 0 && metadata_position + 32 < to_i64(data.len()) {
        let start = i64_to_usize(metadata_position, "metadata position")?;
        xml_metadata = metadata_fields(&data[start..])?;
    }

    let all = czi_subblock_entries(data, directory_position)?;
    if all.is_empty() {
        return Err(DecodeError::new("CZI file contains no image subblocks"));
    }
    let plane = select_plane(&all, &options)?;
    validate_codecs(&all, &plane.full, plane.pixel_type_id)?;
    let region = CziRegion {
        x: 0,
        y: 0,
        width: plane.width,
        height: plane.height,
        factor: 1,
    };
    let mut tiles: Vec<(usize, &[u8])> = Vec::with_capacity(plane.full.len());
    for &index in &plane.full {
        let position = all[index].file_position;
        let start = i64_to_usize(position, "segment position")?;
        if position < 0 || start.checked_add(32).is_none_or(|end| end > data.len()) {
            return Err(DecodeError::new(format!(
                "CZI segment out of range at {position}"
            )));
        }
        tiles.push((index, &data[start..]));
    }
    let out = compose_region(&all, &plane, &tiles, &region)?;
    let metadata_json = plane_metadata(&plane, xml_metadata, plane.full.len());
    parsed(&plane, plane.width, plane.height, metadata_json, out)
}

// ---------------------------------------------------------------------------
// Ranged access: the viewer reads only the header, the directory and the
// subblocks a view needs, instead of the whole file.
// ---------------------------------------------------------------------------

/// Directory entries of a ZISRAWDIRECTORY segment (starting at its header).
fn directory_entries(directory: &[u8]) -> Result<Vec<CziDirectoryEntry>, DecodeError> {
    let segment = czi_segment(directory, 0)?;
    if segment.id != "ZISRAWDIRECTORY" {
        return Err(DecodeError::new("CZI directory segment not found"));
    }
    let count = i32_le(directory, segment.data_start)?;
    if count <= 0 {
        return Err(DecodeError::new("CZI file contains no image subblocks"));
    }
    // EntryCount (4 bytes) is followed by 124 reserved bytes.
    let mut offset = add(segment.data_start, 128)?;
    let mut entries = Vec::with_capacity(usize::try_from(count).unwrap_or(0));
    for _ in 0..count {
        let entry = czi_directory_entry(directory, offset)?;
        offset = add(offset, entry.byte_length)?;
        entries.push(entry);
    }
    Ok(entries)
}

struct RangedOptions {
    decode: DecodeOptions,
    factor: u32,
    region: Option<(i64, i64, usize, usize)>,
    file_size: i64,
    boundaries: Vec<i64>,
    /// Only the subblocks at these file positions (one pool job per tile).
    positions: Option<Vec<i64>>,
}

fn parse_ranged_options(options_json: &str) -> RangedOptions {
    let decode = parse_options(options_json);
    let root = super::json_value::parse(options_json).ok();
    let number = |key: &str| {
        root.as_ref()
            .and_then(|r| r.get(key))
            .and_then(JsonValue::as_num)
    };
    let region = root.as_ref().and_then(|r| r.get("rect")).and_then(|rect| {
        let field = |key: &str| rect.get(key).and_then(JsonValue::as_num);
        Some((
            f64_to_i64(field("x")?),
            f64_to_i64(field("y")?),
            f64_to_usize(field("width")?.max(0.0)),
            f64_to_usize(field("height")?.max(0.0)),
        ))
    });
    let boundaries = root
        .as_ref()
        .and_then(|r| r.get("boundaries"))
        .and_then(|v| match v {
            JsonValue::Arr(items) => Some(
                items
                    .iter()
                    .filter_map(JsonValue::as_num)
                    .map(f64_to_i64)
                    .collect(),
            ),
            _ => None,
        })
        .unwrap_or_default();
    let positions = root
        .as_ref()
        .and_then(|r| r.get("positions"))
        .and_then(|v| match v {
            JsonValue::Arr(items) => Some(
                items
                    .iter()
                    .filter_map(JsonValue::as_num)
                    .map(f64_to_i64)
                    .collect(),
            ),
            _ => None,
        });
    RangedOptions {
        decode,
        factor: number("factor").map_or(1, |f| f64_to_u32(f.max(1.0).round())),
        region,
        file_size: number("fileSize").map_or(i64::MAX, f64_to_i64),
        boundaries,
        positions,
    }
}

/// Where the directory and the metadata start, from the file's first 512 bytes.
pub(crate) fn czi_header_json(head: &[u8]) -> Result<String, DecodeError> {
    if head.len() < 0x50 + 32 || ascii(head, 0, 10) != "ZISRAWFILE" {
        return Err(DecodeError::new("Invalid CZI signature"));
    }
    let header = czi_segment(head, 0)?.data_start;
    let file_part = i32_le(head, add(header, 0x30)?)?;
    if file_part != 0 {
        return Err(DecodeError::new(
            "Multi-file CZI sets are not supported; open the master file (part 0)",
        ));
    }
    let directory = i64_le(head, add(header, 0x34)?)?;
    let metadata = i64_le(head, add(header, 0x3c)?)?;
    // 0x44 is UpdatePending (i32); the attachment directory follows it.
    let attachments = i64_le(head, add(header, 0x48)?).unwrap_or(0);
    Ok(to_json_string(&JsonValue::Obj(vec![
        ("directoryPosition".to_string(), num_i64(directory)),
        ("metadataPosition".to_string(), num_i64(metadata)),
        (
            "attachmentDirectoryPosition".to_string(),
            num_i64(attachments),
        ),
    ])))
}

/// The plane `options` selects: its full size, the stored pyramid factors,
/// whether it needs the JPEG XR decoder, and its metadata.
pub(crate) fn czi_layout_json(
    directory: &[u8],
    metadata: &[u8],
    options_json: &str,
) -> Result<String, DecodeError> {
    let options = parse_ranged_options(options_json);
    let all = directory_entries(directory)?;
    let plane = select_plane(&all, &options.decode)?;
    let mut factors = vec![1u32];
    factors.extend(plane.levels.iter().map(|(factor, _)| *factor));
    let needs_jpegxr = plane
        .full
        .iter()
        .chain(plane.levels.iter().flat_map(|(_, tiles)| tiles.iter()))
        .any(|&index| all[index].compression == 4);
    let metadata_json = plane_metadata(&plane, metadata_fields(metadata)?, plane.full.len());
    let pixel_type = &plane.pixel_type;
    Ok(to_json_string(&JsonValue::Obj(vec![
        ("width".to_string(), num_usize(plane.width)),
        ("height".to_string(), num_usize(plane.height)),
        (
            "channels".to_string(),
            JsonValue::Num(f64::from(pixel_type.channels)),
        ),
        (
            "bitsPerSample".to_string(),
            JsonValue::Num(f64::from(pixel_type.bits_per_sample)),
        ),
        (
            "sampleFormat".to_string(),
            JsonValue::Num(f64::from(pixel_type.sample_format)),
        ),
        ("typeMin".to_string(), JsonValue::Num(pixel_type.type_min)),
        ("typeMax".to_string(), JsonValue::Num(pixel_type.type_max)),
        (
            "sourceNumericType".to_string(),
            JsonValue::Str(pixel_type.source_numeric_type.to_string()),
        ),
        (
            "factors".to_string(),
            JsonValue::Arr(
                factors
                    .iter()
                    .map(|f| JsonValue::Num(f64::from(*f)))
                    .collect(),
            ),
        ),
        ("needsJpegXr".to_string(), JsonValue::Bool(needs_jpegxr)),
        ("metadataJson".to_string(), JsonValue::Str(metadata_json)),
    ])))
}

/// The region (or the whole plane) `options` asks for, the stored level it
/// reads and the byte range of each subblock: from its position to the next
/// known segment (`boundaries`, the directory, metadata) or the file's end.
fn region_for(plane: &CziPlane, options: &RangedOptions) -> CziRegion {
    let (x, y, width, height) = options.region.unwrap_or((0, 0, plane.width, plane.height));
    let x = x.clamp(0, to_i64(plane.width));
    let y = y.clamp(0, to_i64(plane.height));
    CziRegion {
        x,
        y,
        width: width.min(plane.width - non_negative_usize(x)).max(1),
        height: height.min(plane.height - non_negative_usize(y)).max(1),
        factor: options.factor.max(1),
    }
}

/// The subblocks a region reads, in directory order: those of its source
/// level that meet it, narrowed to `positions` when the caller asks for some.
fn planned_tiles(
    all: &[CziDirectoryEntry],
    plane: &CziPlane,
    region: &CziRegion,
    options: &RangedOptions,
) -> (u32, Vec<usize>) {
    let (level, level_tiles) = source_level(plane, region.factor);
    let mut tiles = tiles_in_region(all, plane, level_tiles, region);
    if let Some(positions) = &options.positions {
        tiles.retain(|&index| positions.contains(&all[index].file_position));
    }
    (level, tiles)
}

pub(crate) fn czi_region_plan_json(
    directory: &[u8],
    options_json: &str,
) -> Result<String, DecodeError> {
    let options = parse_ranged_options(options_json);
    let all = directory_entries(directory)?;
    let plane = select_plane(&all, &options.decode)?;
    let region = region_for(&plane, &options);
    let (level, tiles) = planned_tiles(&all, &plane, &region, &options);
    validate_codecs(&all, &tiles, plane.pixel_type_id)?;

    let mut starts: Vec<i64> = all.iter().map(|entry| entry.file_position).collect();
    starts.extend(options.boundaries.iter().copied());
    starts.sort_unstable();
    starts.dedup();
    let (width, height) = region.output_size();
    let ranges: Vec<JsonValue> = tiles
        .iter()
        .map(|&index| {
            let position = all[index].file_position;
            let next = starts
                .iter()
                .copied()
                .find(|&start| start > position)
                .unwrap_or(options.file_size)
                .min(options.file_size);
            JsonValue::Arr(vec![num_i64(position), num_i64((next - position).max(32))])
        })
        .collect();
    // Each subblock's logical rectangle, from the plane's top-left.
    let rects: Vec<JsonValue> = tiles
        .iter()
        .map(|&index| {
            let dims = &all[index].dimensions;
            let x = find_dim(dims, "X").copied().unwrap_or(CziDimension {
                start: 0,
                size: 0,
                stored_size: 0,
            });
            let y = find_dim(dims, "Y").copied().unwrap_or(CziDimension {
                start: 0,
                size: 0,
                stored_size: 0,
            });
            JsonValue::Arr(vec![
                num_i64(i64::from(x.start) - plane.min_x),
                num_i64(i64::from(y.start) - plane.min_y),
                num_i64(i64::from(x.size)),
                num_i64(i64::from(y.size)),
            ])
        })
        .collect();
    Ok(to_json_string(&JsonValue::Obj(vec![
        ("width".to_string(), num_usize(width)),
        ("height".to_string(), num_usize(height)),
        ("sourceFactor".to_string(), JsonValue::Num(f64::from(level))),
        ("ranges".to_string(), JsonValue::Arr(ranges)),
        ("rects".to_string(), JsonValue::Arr(rects)),
    ])))
}

/// Decode a region from the subblocks `czi_region_plan_json` listed, passed
/// back as one buffer of their byte ranges (`offsets[i]` is where the i-th
/// range starts in `blob`, in plan order).
pub(crate) fn decode_czi_region_impl(
    directory: &[u8],
    options_json: &str,
    blob: &[u8],
    offsets: &[u32],
) -> Result<ScientificParsed, DecodeError> {
    let options = parse_ranged_options(options_json);
    let all = directory_entries(directory)?;
    let plane = select_plane(&all, &options.decode)?;
    let region = region_for(&plane, &options);
    let (_, tiles) = planned_tiles(&all, &plane, &region, &options);
    if tiles.len() != offsets.len() {
        return Err(DecodeError::new(format!(
            "CZI region expects {} subblocks, received {}",
            tiles.len(),
            offsets.len()
        )));
    }
    validate_codecs(&all, &tiles, plane.pixel_type_id)?;
    let mut parts: Vec<(usize, &[u8])> = Vec::with_capacity(tiles.len());
    for (i, &index) in tiles.iter().enumerate() {
        let start = offsets[i] as usize;
        let end = offsets.get(i + 1).map_or(blob.len(), |&next| next as usize);
        if start > end || end > blob.len() {
            return Err(DecodeError::new(
                "CZI region subblock range is out of bounds",
            ));
        }
        parts.push((index, &blob[start..end]));
    }
    let out = compose_region(&all, &plane, &parts, &region)?;
    let (width, height) = region.output_size();
    parsed(&plane, width, height, String::from("{}"), out)
}

#[cfg(test)]
mod tests {
    use super::{decode_czi_subblock, pixel_type_info};

    #[test]
    fn czi_lzw_dispatch_uses_the_shared_tiff_stream() {
        let pixels: Vec<u8> = (0..4096).map(|i| ((i * 29 + i / 7) & 0xff) as u8).collect();
        let encoded = weezl::encode::Encoder::with_tiff_size_switch(weezl::BitOrder::Msb, 8)
            .encode(&pixels)
            .expect("encode fixture");
        let decoded = decode_czi_subblock(
            &encoded,
            2,
            pixels.len(),
            &pixel_type_info(0).unwrap(),
            64,
            64,
        )
        .unwrap();
        assert_eq!(decoded.pixels, pixels);
        assert!(!decoded.rgb_order);
    }

    #[test]
    fn czi_jpeg_dispatch_matches_the_general_decoder() {
        let dicom =
            include_bytes!("../../../../test-samples/scientific/synthetic-ct-jpegbaseline-rgb.dcm");
        let start = dicom
            .windows(2)
            .position(|pair| pair == [0xff, 0xd8])
            .expect("JPEG SOI");
        let end = dicom[start..]
            .windows(2)
            .position(|pair| pair == [0xff, 0xd9])
            .map(|offset| start + offset + 2)
            .expect("JPEG EOI");
        let jpeg = &dicom[start..end];
        let mut reference = crate::decode_jpeg_with_channels(jpeg, 3).unwrap();
        let decoded =
            decode_czi_subblock(jpeg, 1, 64 * 48 * 3, &pixel_type_info(3).unwrap(), 64, 48)
                .unwrap();
        assert_eq!(decoded.pixels, reference.take_data_as_u8());
        assert!(decoded.rgb_order);
    }

    #[cfg(feature = "codec-jpegxr")]
    #[test]
    fn czi_jpegxr_dispatch_matches_the_general_decoder() {
        let encoded = include_bytes!("../../../../test-samples/standalone_gray16.jxr");
        let reference = super::super::jpegxr::decode_jpegxr_pixels(encoded, "reference").unwrap();
        let decoded = decode_czi_subblock(
            encoded,
            4,
            64 * 48 * 2,
            &pixel_type_info(1).unwrap(),
            64,
            48,
        )
        .unwrap();
        assert_eq!(decoded.pixels, reference.pixels);
        assert!(!decoded.rgb_order);
    }

    #[cfg(not(feature = "codec-jpegxr"))]
    #[test]
    fn czi_jpegxr_dispatch_requests_the_heavy_codec() {
        let encoded = include_bytes!("../../../../test-samples/standalone_gray16.jxr");
        let result = decode_czi_subblock(
            encoded,
            4,
            64 * 48 * 2,
            &pixel_type_info(1).unwrap(),
            64,
            48,
        );
        let error = match result {
            Ok(_) => panic!("core CZI decode unexpectedly carried JPEG XR"),
            Err(error) => error,
        };
        assert!(error.message().starts_with("[external-codec:JPEG XR]"));
    }
}
