//! DICOM decoder.
//!
//! The dataset/element walk (DICM preamble detection and its absence, with
//! the same `^[A-Z]{2}$` heuristic used to guess implicit vs explicit VR
//! when there is none, explicit/implicit VR, little/big-endian transfer
//! syntaxes, undefined-length sequence skipping, Pixel Representation
//! (signed/unsigned) including the sub-byte/sub-word masking quirks,
//! Rescale Slope/Intercept, multi-frame selection, the MONOCHROME1
//! inversion, and the calibration tags `test/measurement-test.js` depends on
//! — Pixel Spacing, Imager Pixel Spacing, Slice Thickness, Spacing Between
//! Slices) remains a hand-rolled walk. It used to be bit-exact against a now
//! -deleted TS oracle; today the oracle is `test/goldens/*.json` (regression)
//! plus `expectedData` in `test/lib/decoder-cases.js` (correctness), and this
//! walk already satisfies both, so it is kept as-is rather than risking a
//! rewrite against those same frozen goldens for no behavioral gain.
//!
//! What DID change: compressed (encapsulated) Pixel Data — JPEG Baseline and
//! RLE Lossless — used to be rejected outright. It is now decoded via
//! `dicom-object` (parses the encapsulated file into an `InMemDicomObject`)
//! and `dicom-pixeldata` (the `PixelDecoder` trait decodes the JPEG/RLE
//! fragments into raw native-form samples), see
//! `decode_compressed_frame` below. The decoded bytes are then run back
//! through the same [`read_sample`]/Rescale Slope-Intercept/MONOCHROME1
//! pipeline the native path uses, so behavior stays uniform between the two.
//! `dicom-pixeldata`'s "native" feature covers JPEG (via `jpeg-decoder`,
//! pure Rust) and RLE (via a pure-Rust PackBits-style decoder) — both build
//! for wasm32-unknown-unknown with no C dependencies. Any other compressed
//! transfer syntax (JPEG-LS, JPEG 2000, ...) still hits the same
//! "Compressed or unsupported DICOM Transfer Syntax" rejection as before.
//!
//! Held equal to the frozen goldens by `test/rust-scientific-conformance-test.js`.

use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{ascii, get_slice, js_number, scaled_domain, ScientificParsed};
use crate::DecodeError;
use dicom_pixeldata::PixelDecoder;
use std::collections::HashMap;
use std::io::Cursor;

/// VRs whose value length is a 4-byte field (after 2 reserved bytes) instead
/// of the normal 2-byte field — mirrors the TS `LONG_VR` set.
fn is_long_vr(vr: &str) -> bool {
    matches!(
        vr,
        "OB" | "OD" | "OF" | "OL" | "OV" | "OW" | "SQ" | "UC" | "UR" | "UT" | "UN"
    )
}

#[derive(Clone, Copy)]
struct TagEntry {
    offset: usize,
    length: u32,
}

struct Encoding {
    explicit: bool,
    little: bool,
    /// `Some(_)` for a compressed transfer syntax we can actually decode via
    /// `dicom-object`/`dicom-pixeldata` (JPEG Baseline or RLE Lossless); the
    /// payload is an informational label only (no error text depends on it
    /// anymore, now that both decode successfully).
    compressed: Option<&'static str>,
}

struct DicomContext<'a> {
    data: &'a [u8],
    encoding: Encoding,
    transfer_syntax: String,
    tags: HashMap<u32, TagEntry>,
    pixel_tag: u32,
    pixel_offset: usize,
    pixel_length: u32,
}

struct RawElement {
    group: u16,
    tag: u32,
    length: u32,
    value_offset: usize,
}

fn read_u16(data: &[u8], offset: usize, little: bool) -> Option<u16> {
    let b = data.get(offset..offset.checked_add(2)?)?;
    Some(if little {
        u16::from_le_bytes([b[0], b[1]])
    } else {
        u16::from_be_bytes([b[0], b[1]])
    })
}

fn read_u32(data: &[u8], offset: usize, little: bool) -> Option<u32> {
    let b = data.get(offset..offset.checked_add(4)?)?;
    Some(if little {
        u32::from_le_bytes([b[0], b[1], b[2], b[3]])
    } else {
        u32::from_be_bytes([b[0], b[1], b[2], b[3]])
    })
}

/// Mirrors TS `dicomElement()`: reads one data element header at `offset`.
/// Returns `None` where the TS returns `null` (not enough bytes remaining).
fn dicom_element(data: &[u8], offset: usize, explicit: bool, little: bool) -> Option<RawElement> {
    if offset.checked_add(8)? > data.len() {
        return None;
    }
    let group = read_u16(data, offset, little)?;
    let element = read_u16(data, offset + 2, little)?;
    let tag = ((group as u32) << 16) | (element as u32);
    let (length, value_offset) = if explicit {
        let vr = ascii(data, offset + 4, 2);
        if is_long_vr(&vr) {
            if offset.checked_add(12)? > data.len() {
                return None;
            }
            (read_u32(data, offset + 8, little)?, offset + 12)
        } else {
            (read_u16(data, offset + 6, little)? as u32, offset + 8)
        }
    } else {
        (read_u32(data, offset + 4, little)?, offset + 8)
    };
    let _ = element;
    Some(RawElement {
        group,
        tag,
        length,
        value_offset,
    })
}

/// Mirrors TS `findSequenceEnd()`: linear scan for the Sequence Delimitation
/// Item tag (FFFE,E0DD), byte-order-sensitive.
fn find_sequence_end(data: &[u8], start: usize, little: bool) -> Result<usize, DecodeError> {
    let marker: [u8; 4] = if little {
        [0xfe, 0xff, 0xdd, 0xe0]
    } else {
        [0xff, 0xfe, 0xe0, 0xdd]
    };
    let mut i = start;
    while i.checked_add(8).map(|e| e <= data.len()).unwrap_or(false) {
        if data[i] == marker[0]
            && data[i + 1] == marker[1]
            && data[i + 2] == marker[2]
            && data[i + 3] == marker[3]
        {
            return Ok(i + 8);
        }
        i += 1;
    }
    Err(DecodeError::new("Unsupported unterminated DICOM sequence"))
}

fn trim_dicom_string(s: &str) -> &str {
    s.trim_end_matches(['\0', ' '])
}

/// Mirrors TS `parseDicomContext()`.
fn parse_dicom_context(data: &[u8]) -> Result<DicomContext<'_>, DecodeError> {
    let has_preamble = data.len() >= 132 && ascii(data, 128, 4) == "DICM";
    let mut offset: usize = if has_preamble { 132 } else { 0 };
    let mut transfer_syntax = "1.2.840.10008.1.2".to_string();

    if has_preamble {
        while offset
            .checked_add(8)
            .map(|e| e <= data.len())
            .unwrap_or(false)
        {
            let el = match dicom_element(data, offset, true, true) {
                Some(el) => el,
                None => break,
            };
            if el.group != 0x0002 {
                break;
            }
            if el.tag == 0x0002_0010 {
                let len = el.length as usize;
                transfer_syntax = trim_dicom_string(&ascii(data, el.value_offset, len)).to_string();
            }
            offset = el
                .value_offset
                .checked_add(el.length as usize)
                .ok_or_else(|| DecodeError::new("Truncated DICOM element"))?;
        }
    }

    let encoding = if has_preamble {
        match transfer_syntax.as_str() {
            "1.2.840.10008.1.2" => Encoding {
                explicit: false,
                little: true,
                compressed: None,
            },
            "1.2.840.10008.1.2.1" => Encoding {
                explicit: true,
                little: true,
                compressed: None,
            },
            "1.2.840.10008.1.2.2" => Encoding {
                explicit: true,
                little: false,
                compressed: None,
            },
            "1.2.840.10008.1.2.4.50" => Encoding {
                explicit: true,
                little: true,
                compressed: Some("jpeg-baseline"),
            },
            "1.2.840.10008.1.2.5" => Encoding {
                explicit: true,
                little: true,
                compressed: Some("rle-lossless"),
            },
            _ => {
                return Err(DecodeError::new(&format!(
                    "Compressed or unsupported DICOM Transfer Syntax: {}",
                    transfer_syntax
                )));
            }
        }
    } else {
        let possible_vr = ascii(data, 4, 2);
        let explicit =
            possible_vr.len() == 2 && possible_vr.chars().all(|c| c.is_ascii_uppercase());
        Encoding {
            explicit,
            little: true,
            compressed: None,
        }
    };

    let mut tags: HashMap<u32, TagEntry> = HashMap::new();
    let mut pixel_tag: u32 = 0;
    let mut pixel_offset: usize = 0;
    let mut pixel_length: u32 = 0;
    while offset
        .checked_add(8)
        .map(|e| e <= data.len())
        .unwrap_or(false)
    {
        let el = match dicom_element(data, offset, encoding.explicit, encoding.little) {
            Some(el) => el,
            None => break,
        };
        if el.tag == 0x7fe0_0010 || el.tag == 0x7fe0_0008 || el.tag == 0x7fe0_0009 {
            pixel_tag = el.tag;
            pixel_offset = el.value_offset;
            pixel_length = el.length;
            if el.length != 0xffff_ffff {
                tags.insert(
                    el.tag,
                    TagEntry {
                        offset: el.value_offset,
                        length: el.length,
                    },
                );
            }
            break;
        }
        if el.length == 0xffff_ffff {
            offset = find_sequence_end(data, el.value_offset, encoding.little)?;
            continue;
        }
        let end = el
            .value_offset
            .checked_add(el.length as usize)
            .ok_or_else(|| DecodeError::new("Truncated DICOM element"))?;
        if end > data.len() {
            return Err(DecodeError::new("Truncated DICOM element"));
        }
        tags.insert(
            el.tag,
            TagEntry {
                offset: el.value_offset,
                length: el.length,
            },
        );
        offset = end;
    }
    if pixel_tag == 0 {
        return Err(DecodeError::new("DICOM file has no Pixel Data"));
    }
    Ok(DicomContext {
        data,
        encoding,
        transfer_syntax,
        tags,
        pixel_tag,
        pixel_offset,
        pixel_length,
    })
}

struct DicomImageInfo {
    rows: u32,
    columns: u32,
    samples: u32,
    planar: u32,
    bits_allocated: u32,
    bits_stored: u32,
    signed: bool,
    frames: u32,
    photometric: String,
    slope: f64,
    intercept: f64,
    bits_per_sample: u32,
    sample_format: u32,
    type_min: f64,
    type_max: f64,
    source_numeric_type: String,
    metadata_fields: Vec<(String, JsonValue)>,
}

/// `2 ** exp` computed on f64, matching JS `**` (including negative/fractional
/// exponents, which the sub-byte Bits Stored quirks below can produce).
fn pow2(exp: f64) -> f64 {
    2f64.powf(exp)
}

/// Mirrors TS `dicomImageInfo()`.
fn dicom_image_info(context: &DicomContext) -> Result<DicomImageInfo, DecodeError> {
    let DicomContext {
        data,
        encoding,
        tags,
        pixel_tag,
        transfer_syntax,
        ..
    } = context;
    let get = |tag: u32| tags.get(&tag);
    let uint16 = |tag: u32, fallback: u32| -> u32 {
        match get(tag) {
            Some(el) if el.length >= 2 => read_u16(data, el.offset, encoding.little)
                .map(|v| v as u32)
                .unwrap_or(fallback),
            _ => fallback,
        }
    };
    let text = |tag: u32, fallback: &str| -> String {
        match get(tag) {
            Some(el) => trim_dicom_string(&ascii(data, el.offset, el.length as usize)).to_string(),
            None => fallback.to_string(),
        }
    };
    let decimal = |tag: u32, fallback: f64| -> f64 {
        let full = text(tag, "");
        let raw = full.split('\\').next().unwrap_or("").trim();
        if raw.is_empty() {
            fallback
        } else {
            let n = js_number(raw);
            if n.is_finite() {
                n
            } else {
                fallback
            }
        }
    };

    let rows = uint16(0x0028_0010, 0);
    let columns = uint16(0x0028_0011, 0);
    let samples = uint16(0x0028_0002, 1);
    let planar = uint16(0x0028_0006, 0);
    let bits_allocated_fallback = if *pixel_tag == 0x7fe0_0008 {
        32
    } else if *pixel_tag == 0x7fe0_0009 {
        64
    } else {
        0
    };
    let bits_allocated = uint16(0x0028_0100, bits_allocated_fallback);
    let bits_stored = uint16(0x0028_0101, bits_allocated);
    let signed = uint16(0x0028_0103, 0) == 1;
    let frames = 1u32.max(decimal(0x0028_0008, 1.0).floor().max(0.0) as u32);
    let photometric = text(
        0x0028_0004,
        if samples == 3 { "RGB" } else { "MONOCHROME2" },
    );

    if rows == 0 || columns == 0 || !(samples == 1 || samples == 3 || samples == 4) {
        return Err(DecodeError::new(
            "Unsupported DICOM image dimensions or samples per pixel",
        ));
    }
    if !(bits_allocated == 8
        || bits_allocated == 16
        || bits_allocated == 32
        || bits_allocated == 64)
    {
        return Err(DecodeError::new(&format!(
            "Unsupported DICOM Bits Allocated: {}",
            bits_allocated
        )));
    }

    let slope = decimal(0x0028_1053, 1.0);
    let intercept = decimal(0x0028_1052, 0.0);
    let sample_format: u32 = if *pixel_tag == 0x7fe0_0008 || *pixel_tag == 0x7fe0_0009 {
        3
    } else if signed {
        2
    } else {
        1
    };
    let stored_min = if sample_format == 3 {
        0.0
    } else if signed {
        -pow2(bits_stored as f64 - 1.0)
    } else {
        0.0
    };
    let stored_max = if sample_format == 3 {
        1.0
    } else if signed {
        pow2(bits_stored as f64 - 1.0) - 1.0
    } else {
        pow2(bits_stored as f64) - 1.0
    };
    let (type_min, type_max) = scaled_domain(stored_min, stored_max, slope, intercept);
    let source_numeric_type = if sample_format == 3 {
        if bits_allocated <= 32 {
            "float32".to_string()
        } else {
            "float64".to_string()
        }
    } else {
        let width = if bits_stored <= 8 {
            8
        } else if bits_stored <= 16 {
            16
        } else {
            32
        };
        format!("{}{}", if signed { "int" } else { "uint" }, width)
    };

    let window_center = decimal(0x0028_1050, f64::NAN);
    let window_width = decimal(0x0028_1051, f64::NAN);
    let modality = text(0x0008_0060, "");
    let pixel_spacing = text(0x0028_0030, "");
    let imager_pixel_spacing = text(0x0018_1164, "");
    let slice_thickness = text(0x0018_0050, "");
    let spacing_between_slices = text(0x0018_0088, "");

    let mut fields: Vec<(String, JsonValue)> = Vec::new();
    fields.push(("format".to_string(), JsonValue::Str("DICOM".to_string())));
    fields.push((
        "transferSyntax".to_string(),
        JsonValue::Str(transfer_syntax.clone()),
    ));
    fields.push((
        "photometric".to_string(),
        JsonValue::Str(photometric.clone()),
    ));
    fields.push((
        "bitsAllocated".to_string(),
        JsonValue::Num(bits_allocated as f64),
    ));
    fields.push(("bitsStored".to_string(), JsonValue::Num(bits_stored as f64)));
    fields.push(("signed".to_string(), JsonValue::Bool(signed)));
    fields.push(("frames".to_string(), JsonValue::Num(frames as f64)));
    fields.push(("rescaleSlope".to_string(), JsonValue::Num(slope)));
    fields.push(("rescaleIntercept".to_string(), JsonValue::Num(intercept)));
    // `windowCenter`/`windowWidth` are always present, even when absent from
    // the file: TS sets them to `NaN`, and `JSON.stringify` turns a NaN
    // *property value* into `null` (unlike `undefined`, which drops the key).
    fields.push(("windowCenter".to_string(), JsonValue::Num(window_center)));
    fields.push(("windowWidth".to_string(), JsonValue::Num(window_width)));
    push_opt(
        &mut fields,
        "modality",
        if modality.is_empty() {
            None
        } else {
            Some(JsonValue::Str(modality))
        },
    );
    push_opt(
        &mut fields,
        "pixelSpacing",
        if pixel_spacing.is_empty() {
            None
        } else {
            Some(JsonValue::Str(pixel_spacing))
        },
    );
    push_opt(
        &mut fields,
        "imagerPixelSpacing",
        if imager_pixel_spacing.is_empty() {
            None
        } else {
            Some(JsonValue::Str(imager_pixel_spacing))
        },
    );
    push_opt(
        &mut fields,
        "sliceThickness",
        if slice_thickness.is_empty() {
            None
        } else {
            Some(JsonValue::Str(slice_thickness))
        },
    );
    push_opt(
        &mut fields,
        "spacingBetweenSlices",
        if spacing_between_slices.is_empty() {
            None
        } else {
            Some(JsonValue::Str(spacing_between_slices))
        },
    );

    Ok(DicomImageInfo {
        rows: rows as u32,
        columns: columns as u32,
        samples: samples as u32,
        planar: planar as u32,
        bits_allocated: bits_allocated as u32,
        bits_stored: bits_stored as u32,
        signed,
        frames,
        photometric,
        slope,
        intercept,
        bits_per_sample: bits_stored as u32,
        sample_format,
        type_min,
        type_max,
        source_numeric_type,
        metadata_fields: fields,
    })
}

/// Mask applied to an unsigned sample narrower than its allocated width —
/// mirrors JS `value &= (2 ** bitsStored) - 1`, including its ToInt32
/// wraparound for `bitsStored >= 32` (where `(2**bitsStored - 1)`'s low 32
/// bits are always all-ones, i.e. `-1`, regardless of how far past 32 the
/// exponent goes — so clamping the shift to 32 reproduces it exactly).
fn stored_mask(bits_stored: u32) -> u32 {
    let shift = (bits_stored as u64).min(32);
    ((1u64 << shift) - 1) as u32
}

/// Read one raw (pre-slope/intercept) sample. Mirrors the TS `readSample`
/// closure in `parseDicom` exactly, including the sub-byte/sub-word signed
/// quirks (computed in f64 to match JS `2 ** x` behavior even for the
/// degenerate `bitsStored <= 0` case).
fn read_sample(
    data: &[u8],
    pixel_tag: u32,
    little: bool,
    p: usize,
    bits_allocated: u32,
    bits_stored: u32,
    signed: bool,
) -> Result<f64, DecodeError> {
    if pixel_tag == 0x7fe0_0008 {
        let b = get_slice(data, p, 4, "DICOM")?;
        let bits = if little {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        };
        return Ok(f32::from_bits(bits) as f64);
    }
    if pixel_tag == 0x7fe0_0009 {
        let b = get_slice(data, p, 8, "DICOM")?;
        let bits = if little {
            u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
        } else {
            u64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
        };
        return Ok(f64::from_bits(bits));
    }
    if bits_allocated == 8 {
        let b = get_slice(data, p, 1, "DICOM")?;
        let mut value = b[0] as f64;
        if signed && bits_stored < 8 && value >= pow2(bits_stored as f64 - 1.0) {
            value -= pow2(bits_stored as f64);
        } else if signed && bits_stored == 8 {
            value = (b[0] as i8) as f64;
        }
        return Ok(value);
    }
    if bits_allocated == 16 {
        let b = get_slice(data, p, 2, "DICOM")?;
        let mut value = (if little {
            u16::from_le_bytes([b[0], b[1]])
        } else {
            u16::from_be_bytes([b[0], b[1]])
        }) as u32;
        if bits_stored < 16 {
            value &= stored_mask(bits_stored);
        }
        let mut value = value as f64;
        if signed && value >= pow2(bits_stored as f64 - 1.0) {
            value -= pow2(bits_stored as f64);
        }
        return Ok(value);
    }
    // bits_allocated == 32 (validated by the caller's Bits Allocated check)
    let b = get_slice(data, p, 4, "DICOM")?;
    Ok(if signed {
        (if little {
            i32::from_le_bytes([b[0], b[1], b[2], b[3]])
        } else {
            i32::from_be_bytes([b[0], b[1], b[2], b[3]])
        }) as f64
    } else {
        (if little {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        }) as f64
    })
}

/// Decode one native (uncompressed) frame's raw (pre Rescale Slope/
/// Intercept) samples, in row-major pixel*channel order. Mirrors the
/// relevant part of the TS `parseDicom` loop exactly (sub-byte/sub-word
/// signed masking quirks included via [`read_sample`]).
fn decode_native_frame(
    context: &DicomContext,
    info: &DicomImageInfo,
    safe_frame: u32,
) -> Result<Vec<f64>, DecodeError> {
    let DicomContext { data, encoding, .. } = context;
    let little = encoding.little;
    let pixel_tag = context.pixel_tag;
    let pixel_offset = context.pixel_offset;
    let pixel_length = context.pixel_length;
    let DicomImageInfo {
        rows,
        columns,
        samples,
        planar,
        bits_allocated,
        bits_stored,
        signed,
        ..
    } = *info;

    let bytes_per_sample = bits_allocated / 8;
    let sample_count = (rows as usize)
        .checked_mul(columns as usize)
        .and_then(|v| v.checked_mul(samples as usize))
        .ok_or_else(|| DecodeError::new("DICOM: dimensions overflow"))?;
    let frame_bytes_f64 = sample_count as f64 * bytes_per_sample as f64;
    let needed_f64 = (safe_frame as f64 + 1.0) * frame_bytes_f64;
    if (pixel_length as f64) < needed_f64 {
        return Err(DecodeError::new("Truncated DICOM Pixel Data"));
    }
    let frame_sample_offset = (safe_frame as usize)
        .checked_mul(sample_count)
        .ok_or_else(|| DecodeError::new("DICOM: frame offset overflow"))?;

    let read_at = |sample_index: usize| -> Result<f64, DecodeError> {
        let idx = frame_sample_offset
            .checked_add(sample_index)
            .ok_or_else(|| DecodeError::new("DICOM: sample index overflow"))?;
        let p = pixel_offset
            .checked_add(
                idx.checked_mul(bytes_per_sample as usize)
                    .ok_or_else(|| DecodeError::new("DICOM: offset overflow"))?,
            )
            .ok_or_else(|| DecodeError::new("DICOM: offset overflow"))?;
        read_sample(
            data,
            pixel_tag,
            little,
            p,
            bits_allocated,
            bits_stored,
            signed,
        )
    };

    let pixel_count = (rows as usize) * (columns as usize);
    let mut raw = vec![0f64; sample_count];
    for pixel_index in 0..pixel_count {
        for channel in 0..(samples as usize) {
            let source_index = if planar == 1 && samples > 1 {
                channel * pixel_count + pixel_index
            } else {
                pixel_index * (samples as usize) + channel
            };
            raw[pixel_index * (samples as usize) + channel] = read_at(source_index)?;
        }
    }
    Ok(raw)
}

/// Decode one frame of compressed (encapsulated) Pixel Data — JPEG Baseline
/// or RLE Lossless — via `dicom-object` (parsing) and `dicom-pixeldata`
/// (codec decode). Returns the raw (pre Rescale Slope/Intercept) samples in
/// row-major pixel*channel order, together with the photometric
/// interpretation `dicom-pixeldata` reports for the DECODED data (e.g.
/// YBR_FULL_422 source samples decode to plain RGB, since both JPEG and RLE
/// adapters always normalize their output to standard/interleaved planar
/// configuration).
fn decode_compressed_frame(
    data: &[u8],
    safe_frame: u32,
) -> Result<(Vec<f64>, String), DecodeError> {
    let file_obj = dicom_object::from_reader(Cursor::new(data)).map_err(|e| {
        DecodeError::new(&format!("Failed to parse compressed DICOM dataset: {}", e))
    })?;
    let decoded = file_obj.decode_pixel_data_frame(safe_frame).map_err(|e| {
        DecodeError::new(&format!(
            "Failed to decode compressed DICOM Pixel Data: {}",
            e
        ))
    })?;

    let rows = decoded.rows();
    let columns = decoded.columns();
    let samples = decoded.samples_per_pixel() as u32;
    let bits_allocated = decoded.bits_allocated() as u32;
    let bits_stored = decoded.bits_stored() as u32;
    let signed = matches!(
        decoded.pixel_representation(),
        dicom_pixeldata::PixelRepresentation::Signed
    );
    let photometric = decoded.photometric_interpretation().as_str().to_string();
    let bytes = decoded.data();

    let bytes_per_sample = (bits_allocated / 8).max(1) as usize;
    let sample_count = (rows as usize)
        .checked_mul(columns as usize)
        .and_then(|v| v.checked_mul(samples as usize))
        .ok_or_else(|| DecodeError::new("DICOM: dimensions overflow"))?;

    let mut raw = Vec::with_capacity(sample_count);
    for i in 0..sample_count {
        let p = i
            .checked_mul(bytes_per_sample)
            .ok_or_else(|| DecodeError::new("DICOM: offset overflow"))?;
        // Decoded pixel data is always in standard (interleaved) planar
        // configuration, little-endian (matches the wasm32 target's native
        // byte order, which `dicom-pixeldata` uses internally), and never
        // Float/Double Pixel Data (7FE0,0008/0009 cannot be encapsulated per
        // the DICOM standard) — pixel_tag 0x7FE0,0010 always applies here.
        raw.push(read_sample(
            bytes,
            0x7fe0_0010,
            true,
            p,
            bits_allocated,
            bits_stored,
            signed,
        )?);
    }
    Ok((raw, photometric))
}

/// Decode one DICOM frame — native (uncompressed) or compressed (JPEG
/// Baseline / RLE Lossless) Pixel Data alike. Patient-identifying tags are
/// not retained.
pub(crate) fn decode_dicom_impl(
    data: &[u8],
    frame_index: u32,
) -> Result<ScientificParsed, DecodeError> {
    let context = parse_dicom_context(data)?;
    let info = dicom_image_info(&context)?;
    let safe_frame = frame_index.min(info.frames.saturating_sub(1));

    let (raw, photometric) = if context.encoding.compressed.is_some() {
        decode_compressed_frame(data, safe_frame)?
    } else {
        (
            decode_native_frame(&context, &info, safe_frame)?,
            info.photometric.clone(),
        )
    };

    let mut output: Vec<f32> = raw
        .iter()
        .map(|&r| (r * info.slope + info.intercept) as f32)
        .collect();

    if photometric == "MONOCHROME1" {
        let mut min = f32::INFINITY;
        let mut max = f32::NEG_INFINITY;
        for &v in output.iter() {
            if v < min {
                min = v;
            }
            if v > max {
                max = v;
            }
        }
        for v in output.iter_mut() {
            *v = max + min - *v;
        }
    }
    let mut fields = info.metadata_fields;
    if let Some(entry) = fields.iter_mut().find(|(k, _)| k == "photometric") {
        entry.1 = JsonValue::Str(photometric.clone());
    }
    fields.push(("frameIndex".to_string(), JsonValue::Num(safe_frame as f64)));
    let metadata_json = to_json_string(&JsonValue::Obj(fields));

    Ok(ScientificParsed {
        width: info.columns,
        height: info.rows,
        channels: info.samples,
        bits_per_sample: info.bits_per_sample,
        sample_format: info.sample_format,
        type_min: info.type_min,
        type_max: info.type_max,
        source_numeric_type: info.source_numeric_type,
        metadata_json,
        data: output,
    })
}

