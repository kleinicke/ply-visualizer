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
//! What DID change: compressed (encapsulated) Pixel Data used to be rejected
//! outright. Every codec below is now decoded straight from the encapsulated
//! fragments — see `decode_own_codec_frame` — and the decoded bytes are run
//! back through the same [`read_sample`]/Rescale Slope-Intercept/MONOCHROME1
//! pipeline the native path uses, so behavior stays uniform between the two.
//!
//! None of it goes through `dicom-object`/`dicom-pixeldata`. Those decoded
//! JPEG Baseline and RLE Lossless for a while, and they worked, but they cost
//! roughly 400 KiB of the WebAssembly module — the DICOM data dictionary's
//! attribute names alone are 123 KiB of string data, and the transfer-syntax
//! registry drags in `jpeg-decoder` and `jpeg-encoder` beside the `zune-jpeg`
//! this crate already links for TIFF. For two codecs, one of which is
//! PackBits, that is not a trade worth making in a viewer.
//!
//! Held equal to the frozen goldens by `test/rust-scientific-conformance-test.js`.

use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{ascii, get_slice, js_number, scaled_domain, ScientificParsed};
use crate::DecodeError;
use std::collections::HashMap;

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
    /// `Some(_)` for an encapsulated (compressed) transfer syntax, naming the
    /// decoder that handles it.
    compressed: Option<CompressedCodec>,
}

/// Which decoder handles an encapsulated transfer syntax. All of them read
/// the encapsulated fragments directly; see the module note on why none of
/// this goes through `dicom-pixeldata`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum CompressedCodec {
    /// 1.2.840.10008.1.2.4.50 — decoded by the `zune-jpeg` this crate already
    /// links for TIFF's compression 7.
    JpegBaseline,
    /// 1.2.840.10008.1.2.5 — PackBits per byte plane, decoded below.
    RleLossless,
    /// 1.2.840.10008.1.2.4.90 / .91
    Jpeg2000,
    /// 1.2.840.10008.1.2.4.80 / .81
    JpegLs,
    /// 1.2.840.10008.1.2.4.57 / .70 (process 14, selection value 1)
    JpegLossless,
    /// 1.2.840.10008.1.2.4.110/.111/.112
    JpegXl,
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
            // Deflated Explicit VR: the DATASET after the file meta group is
            // one raw deflate stream. `decode_dicom_impl` inflates it before
            // parsing, so by the time the body is read it is plain explicit
            // little-endian.
            "1.2.840.10008.1.2.1.99" => Encoding {
                explicit: true,
                little: true,
                compressed: None,
            },
            "1.2.840.10008.1.2.4.50" => Encoding {
                explicit: true,
                little: true,
                compressed: Some(CompressedCodec::JpegBaseline),
            },
            "1.2.840.10008.1.2.5" => Encoding {
                explicit: true,
                little: true,
                compressed: Some(CompressedCodec::RleLossless),
            },
            "1.2.840.10008.1.2.4.57" | "1.2.840.10008.1.2.4.70" => Encoding {
                explicit: true,
                little: true,
                compressed: Some(CompressedCodec::JpegLossless),
            },
            "1.2.840.10008.1.2.4.80" | "1.2.840.10008.1.2.4.81" => Encoding {
                explicit: true,
                little: true,
                compressed: Some(CompressedCodec::JpegLs),
            },
            "1.2.840.10008.1.2.4.90" | "1.2.840.10008.1.2.4.91" => Encoding {
                explicit: true,
                little: true,
                compressed: Some(CompressedCodec::Jpeg2000),
            },
            "1.2.840.10008.1.2.4.110" | "1.2.840.10008.1.2.4.111" | "1.2.840.10008.1.2.4.112" => {
                Encoding {
                    explicit: true,
                    little: true,
                    compressed: Some(CompressedCodec::JpegXl),
                }
            }
            _ => {
                return Err(DecodeError::new(format!(
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
        return Err(DecodeError::new(format!(
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
    // Frame Label Vector (0018,2002) is the standard top-level mapping from
    // stored frame index to a human-readable frame group.  In particular it
    // lets a multi-frame Secondary Capture retain acquisition/series labels
    // without forcing callers to walk every Per-Frame Functional Group.
    let frame_labels: Vec<String> = text(0x0018_2002, "")
        .split('\\')
        .map(|label| label.trim().to_string())
        .collect();

    let mut fields: Vec<(String, JsonValue)> = vec![
        ("format".to_string(), JsonValue::Str("DICOM".to_string())),
        (
            "transferSyntax".to_string(),
            JsonValue::Str(transfer_syntax.clone()),
        ),
        (
            "photometric".to_string(),
            JsonValue::Str(photometric.clone()),
        ),
        (
            "bitsAllocated".to_string(),
            JsonValue::Num(bits_allocated as f64),
        ),
        ("bitsStored".to_string(), JsonValue::Num(bits_stored as f64)),
        ("signed".to_string(), JsonValue::Bool(signed)),
        ("frames".to_string(), JsonValue::Num(frames as f64)),
    ];
    if frame_labels.len() == frames as usize && frame_labels.iter().any(|label| !label.is_empty()) {
        fields.push((
            "frameLabels".to_string(),
            JsonValue::Arr(frame_labels.into_iter().map(JsonValue::Str).collect()),
        ));
    }
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
        rows,
        columns,
        samples,
        planar,
        bits_allocated,
        bits_stored,
        signed,
        frames,
        photometric,
        slope,
        intercept,
        bits_per_sample: bits_stored,
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

/// `decode_native_frame` then `rescale`, through `rescaled_samples` for 8-
/// and 16-bit integer Pixel Data fully inside the file. None otherwise.
fn native_rescaled_samples(
    context: &DicomContext,
    info: &DicomImageInfo,
    safe_frame: u32,
    sample_count: usize,
) -> Option<Vec<f32>> {
    if context.pixel_tag != PIXEL_DATA {
        return None;
    }
    let width = (info.bits_allocated / 8) as usize;
    let frame_bytes = sample_count.checked_mul(width)?;
    if (context.pixel_length as usize) < frame_bytes.checked_mul(safe_frame as usize + 1)? {
        return None;
    }
    let start = context
        .pixel_offset
        .checked_add(frame_bytes.checked_mul(safe_frame as usize)?)?;
    let samples = info.samples as usize;
    let pixels = (info.rows as usize) * (info.columns as usize);
    let planar = info.planar == 1 && samples > 1;
    rescaled_samples(
        info,
        context.data,
        start,
        sample_count,
        context.encoding.little,
        |i| {
            if planar {
                (i % samples) * pixels + i / samples
            } else {
                i
            }
        },
    )
}

type FragmentRanges = Vec<(usize, usize)>;

/// Locate the fragments of encapsulated Pixel Data.
///
/// The value is a sequence of items: a Basic Offset Table first (often empty),
/// then one or more fragments, ended by a Sequence Delimitation item. Each
/// item is (FFFE,E000) plus a 4-byte length.
fn encapsulated_fragments(
    data: &[u8],
    pixel_offset: usize,
) -> Result<(Vec<u32>, FragmentRanges), DecodeError> {
    let mut offset = pixel_offset;
    let mut offset_table: Vec<u32> = Vec::new();
    let mut fragments: Vec<(usize, usize)> = Vec::new();
    let mut first = true;

    while offset
        .checked_add(8)
        .map(|e| e <= data.len())
        .unwrap_or(false)
    {
        let group = read_u16(data, offset, true).unwrap_or(0);
        let element = read_u16(data, offset + 2, true).unwrap_or(0);
        let length = read_u32(data, offset + 4, true).unwrap_or(0) as usize;
        if group != 0xfffe {
            break;
        }
        if element == 0xe0dd {
            break; // Sequence Delimitation
        }
        if element != 0xe000 {
            break;
        }
        let start = offset + 8;
        let end = start
            .checked_add(length)
            .filter(|end| *end <= data.len())
            .ok_or_else(|| DecodeError::new("DICOM: encapsulated fragment runs past the file"))?;
        if first {
            // Basic Offset Table: 32-bit offsets of each frame's first
            // fragment, measured from the end of this item.
            for chunk in data[start..end].chunks_exact(4) {
                offset_table.push(u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
            }
            first = false;
        } else {
            fragments.push((start, end));
        }
        offset = end;
    }
    if fragments.is_empty() {
        return Err(DecodeError::new(
            "DICOM: encapsulated Pixel Data has no fragments",
        ));
    }
    Ok((offset_table, fragments))
}

/// The compressed bytes of one frame, joining fragments where a frame was
/// split across several.
fn encapsulated_frame_bytes(
    data: &[u8],
    pixel_offset: usize,
    frame: u32,
    frames: u32,
) -> Result<Vec<u8>, DecodeError> {
    let (offset_table, fragments) = encapsulated_fragments(data, pixel_offset)?;
    let frame = frame as usize;

    // One fragment per frame is what almost every encoder writes.
    if fragments.len() == frames as usize {
        let (start, end) = fragments[frame.min(fragments.len() - 1)];
        return Ok(data[start..end].to_vec());
    }
    // Otherwise the Basic Offset Table says where each frame starts. Its
    // offsets are relative to the first fragment's item header.
    if offset_table.len() == frames as usize && frames > 0 {
        let base = fragments[0].0 - 8;
        let frame_start = base + offset_table[frame.min(offset_table.len() - 1)] as usize;
        let frame_end = offset_table
            .get(frame + 1)
            .map(|next| base + *next as usize)
            .unwrap_or(usize::MAX);
        let mut out = Vec::new();
        for (start, end) in &fragments {
            if *start >= frame_start && *start < frame_end {
                out.extend_from_slice(&data[*start..*end]);
            }
        }
        if !out.is_empty() {
            return Ok(out);
        }
    }
    // A single frame split across fragments is simply their concatenation.
    if frames <= 1 {
        let mut out = Vec::new();
        for (start, end) in &fragments {
            out.extend_from_slice(&data[*start..*end]);
        }
        return Ok(out);
    }
    Err(DecodeError::new(format!(
        "DICOM: {} fragments for {} frames with no usable offset table",
        fragments.len(),
        frames
    )))
}

#[cfg(feature = "codec-jpegls")]
/// Refuse a lossless-JPEG codestream whose predictor the decoder gets wrong.
///
/// `pure_jpegli` reproduces selection values 1, 2, 3, 4 and 7 exactly (checked
/// against libjpeg-turbo's own encoder) but not 5 or 6, which come back
/// visibly wrong rather than slightly wrong. Transfer syntax .70 mandates
/// selection value 1 and .57 files use it in practice, so this refuses the two
/// broken cases by name instead of returning a corrupt image.
///
/// The predictor is the first byte after the component specification in the
/// SOS segment (ITU-T T.81 Annex H: Ss carries the selection value).
fn check_lossless_jpeg_predictor(encoded: &[u8]) -> Result<(), DecodeError> {
    let mut offset = 2usize; // past SOI
    while offset + 4 <= encoded.len() {
        if encoded[offset] != 0xff {
            offset += 1;
            continue;
        }
        let marker = encoded[offset + 1];
        if marker == 0xd8 || marker == 0xd9 {
            offset += 2;
            continue;
        }
        let length = u16::from_be_bytes([encoded[offset + 2], encoded[offset + 3]]) as usize;
        if marker == 0xda {
            // SOS: length, component count, then two bytes per component.
            let components = *encoded.get(offset + 4).unwrap_or(&0) as usize;
            let predictor = encoded
                .get(offset + 5 + 2 * components)
                .copied()
                .unwrap_or(1);
            if matches!(predictor, 5 | 6) {
                return Err(DecodeError::new(format!(
                    "DICOM lossless JPEG: predictor {} is not supported (the decoder \
                     reproduces selection values 1-4 and 7 exactly, 5 and 6 incorrectly)",
                    predictor
                )));
            }
            return Ok(());
        }
        offset = offset
            .checked_add(2 + length)
            .ok_or_else(|| DecodeError::new("DICOM lossless JPEG: malformed marker segment"))?;
    }
    Ok(())
}

/// Decode one PackBits-compressed RLE segment (PS3.5 Annex G.3), appending
/// exactly `expected` bytes.
///
/// The control byte is read as a signed value: 0..=127 copies the next n+1
/// bytes literally, 129..=255 repeats the next byte 257-n times, and 128 is a
/// no-op. This is the same scheme as TIFF's compression 32773.
fn unpack_bits(segment: &[u8], expected: usize, out: &mut Vec<u8>) -> Result<(), DecodeError> {
    let target = out.len() + expected;
    let mut offset = 0usize;
    while out.len() < target {
        let control = *segment
            .get(offset)
            .ok_or_else(|| DecodeError::new("DICOM RLE: segment ends mid-frame"))?;
        offset += 1;
        if control == 128 {
            continue;
        }
        if control < 128 {
            let count = control as usize + 1;
            let end = offset
                .checked_add(count)
                .filter(|end| *end <= segment.len())
                .ok_or_else(|| DecodeError::new("DICOM RLE: literal run overruns the segment"))?;
            out.extend_from_slice(&segment[offset..end]);
            offset = end;
        } else {
            let count = 257 - control as usize;
            let value = *segment
                .get(offset)
                .ok_or_else(|| DecodeError::new("DICOM RLE: replicate run overruns the segment"))?;
            offset += 1;
            out.extend(std::iter::repeat_n(value, count));
        }
    }
    if out.len() > target {
        // A run may cross the plane boundary only by overrunning it, which
        // means the segment does not describe this frame.
        return Err(DecodeError::new(
            "DICOM RLE: segment decodes to more bytes than the plane holds",
        ));
    }
    Ok(())
}

/// Decode an RLE Lossless frame (transfer syntax 1.2.840.10008.1.2.5) into
/// interleaved little-endian samples.
///
/// The frame opens with a 64-byte header: the segment count, then each
/// segment's byte offset from the start of the frame. Every segment holds ONE
/// byte plane of the whole image, PackBits-compressed, ordered most
/// significant byte first within each channel (PS3.5 Annex G.2) — so a 16-bit
/// greyscale frame is two segments, high plane then low, and an 8-bit RGB
/// frame is three, one per channel. Reassembling them is the whole job: the
/// bytes come out planar and have to be interleaved, and the per-sample byte
/// order reversed, since everything downstream reads little-endian.
fn decode_rle_lossless(
    frame: &[u8],
    pixels: usize,
    samples: usize,
    bytes_per_sample: usize,
) -> Result<Vec<u8>, DecodeError> {
    if frame.len() < 64 {
        return Err(DecodeError::new(
            "DICOM RLE: frame is shorter than its 64-byte header",
        ));
    }
    let read_u32 = |index: usize| {
        let at = index * 4;
        u32::from_le_bytes([frame[at], frame[at + 1], frame[at + 2], frame[at + 3]]) as usize
    };
    let declared = read_u32(0);
    let expected_segments = samples
        .checked_mul(bytes_per_sample)
        .ok_or_else(|| DecodeError::new("DICOM RLE: segment count overflows"))?;
    if declared != expected_segments || declared == 0 || declared > 15 {
        return Err(DecodeError::new(format!(
            "DICOM RLE: frame declares {} segments, dataset needs {}",
            declared, expected_segments
        )));
    }

    let mut planes: Vec<Vec<u8>> = Vec::with_capacity(declared);
    for index in 0..declared {
        let start = read_u32(1 + index);
        // Offsets are from the start of the frame and must land inside it; the
        // last segment runs to the end.
        let end = if index + 1 < declared {
            read_u32(2 + index)
        } else {
            frame.len()
        };
        if start < 64 || end > frame.len() || start > end {
            return Err(DecodeError::new(format!(
                "DICOM RLE: segment {} spans {}..{}, outside the {}-byte frame",
                index,
                start,
                end,
                frame.len()
            )));
        }
        let mut plane = Vec::with_capacity(pixels);
        unpack_bits(&frame[start..end], pixels, &mut plane)?;
        planes.push(plane);
    }

    let total = pixels
        .checked_mul(expected_segments)
        .ok_or_else(|| DecodeError::new("DICOM RLE: frame size overflows"))?;
    let mut out = vec![0u8; total];
    for channel in 0..samples {
        for byte in 0..bytes_per_sample {
            // Segments run most significant byte first; the output is
            // little-endian, so byte 0 of the segment order is the LAST byte
            // of each sample.
            let plane = &planes[channel * bytes_per_sample + byte];
            let position = bytes_per_sample - 1 - byte;
            for pixel in 0..pixels {
                out[(pixel * samples + channel) * bytes_per_sample + position] = plane[pixel];
            }
        }
    }
    Ok(out)
}

/// Decode one frame compressed with a codec this crate decodes itself —
/// JPEG 2000, JPEG-LS or lossless JPEG. Returns the raw (pre Rescale
/// Slope/Intercept) samples, like `decode_native_frame`.
///
/// Each codec hands back samples of its own width, so they are written into a
/// little-endian buffer of `bits_allocated` and read back through
/// `read_sample`, which is where signedness and Bits Stored are handled for
/// every other path too.
fn decode_own_codec_frame(
    context: &DicomContext,
    info: &DicomImageInfo,
    frame: u32,
    codec: CompressedCodec,
) -> Result<Vec<u8>, DecodeError> {
    let encoded = encapsulated_frame_bytes(context.data, context.pixel_offset, frame, info.frames)?;
    let width = info.columns;
    let height = info.rows;
    let bytes_per_sample = ((info.bits_allocated / 8).max(1)) as usize;

    let bytes: Vec<u8> = match codec {
        #[cfg(not(feature = "jxl"))]
        CompressedCodec::JpegXl => {
            return Err(crate::formats::external_codec::needed(
                "JPEG XL",
                "this DICOM transfer syntax",
            ))
        }
        #[cfg(not(feature = "codec-jpeg2000"))]
        CompressedCodec::Jpeg2000 => {
            return Err(crate::formats::external_codec::needed(
                "JPEG 2000",
                "this DICOM transfer syntax",
            ))
        }
        #[cfg(not(feature = "codec-jpegls"))]
        CompressedCodec::JpegLs | CompressedCodec::JpegLossless => {
            return Err(crate::formats::external_codec::needed(
                "JPEG-LS",
                "this DICOM transfer syntax",
            ))
        }
        #[cfg(feature = "codec-jpeg2000")]
        CompressedCodec::Jpeg2000 => {
            let settings = dicom_toolkit_jpeg2000::DecodeSettings::default();
            let image = dicom_toolkit_jpeg2000::Image::new(&encoded, &settings)
                .map_err(|e| DecodeError::new(format!("DICOM JPEG 2000 header: {:?}", e)))?;
            let raw = image
                .decode_native()
                .map_err(|e| DecodeError::new(format!("DICOM JPEG 2000 decode: {:?}", e)))?;
            // Already little-endian at the codestream's own width; widen to
            // Bits Allocated when the two disagree (12-bit in 16, say).
            if raw.bytes_per_sample as usize == bytes_per_sample {
                raw.data
            } else if raw.bytes_per_sample == 1 && bytes_per_sample == 2 {
                raw.data.iter().flat_map(|v| [*v, 0]).collect()
            } else {
                return Err(DecodeError::new(format!(
                    "DICOM JPEG 2000: {} bytes per sample, dataset says {}",
                    raw.bytes_per_sample, bytes_per_sample
                )));
            }
        }
        #[cfg(feature = "jxl")]
        CompressedCodec::JpegXl => {
            let decoded = crate::formats::jxl::decode_jxl_impl(&encoded)?;
            if decoded.width != width
                || decoded.height != height
                || decoded.channels != info.samples
            {
                return Err(DecodeError::new(format!(
                    "DICOM JPEG XL: codestream is {}x{}x{}, dataset says {}x{}x{}",
                    decoded.width, decoded.height, decoded.channels, width, height, info.samples
                )));
            }
            if decoded.sample_format != 1 || !matches!(info.bits_allocated, 8 | 16) {
                return Err(DecodeError::new(format!(
                    "DICOM JPEG XL: unsupported sample layout {}/{}-bit (Bits Allocated {})",
                    decoded.sample_format, decoded.bits_per_sample, info.bits_allocated
                )));
            }
            if decoded.bits_per_sample > info.bits_allocated {
                return Err(DecodeError::new(format!(
                    "DICOM JPEG XL: {}-bit codestream does not fit {} Bits Allocated",
                    decoded.bits_per_sample, info.bits_allocated
                )));
            }
            if bytes_per_sample == 1 {
                decoded.data.into_iter().map(|value| value as u8).collect()
            } else {
                decoded
                    .data
                    .into_iter()
                    .flat_map(|value| (value as u16).to_le_bytes())
                    .collect()
            }
        }
        #[cfg(feature = "codec-jpegls")]
        CompressedCodec::JpegLs | CompressedCodec::JpegLossless => {
            if codec == CompressedCodec::JpegLossless {
                check_lossless_jpeg_predictor(&encoded)?;
            }
            let (samples, _, _) = if codec == CompressedCodec::JpegLs {
                jpegls::decode(&encoded, width, height)
                    .map_err(|e| DecodeError::new(format!("DICOM JPEG-LS decode: {:?}", e)))?
            } else {
                jpegli::decode(&encoded, width, height)
                    .map_err(|e| DecodeError::new(format!("DICOM lossless JPEG decode: {:?}", e)))?
            };
            if bytes_per_sample == 1 {
                samples.iter().map(|v| *v as u8).collect()
            } else {
                samples.iter().flat_map(|v| v.to_le_bytes()).collect()
            }
        }
        CompressedCodec::JpegBaseline => {
            let mut decoded = crate::decode_jpeg_with_channels(&encoded, info.samples)?;
            if decoded.width() != width || decoded.height() != height {
                return Err(DecodeError::new(format!(
                    "DICOM JPEG Baseline: codestream is {}x{}, dataset says {}x{}",
                    decoded.width(),
                    decoded.height(),
                    width,
                    height
                )));
            }
            if decoded.channels() != info.samples {
                return Err(DecodeError::new(format!(
                    "DICOM JPEG Baseline: codestream has {} channels, dataset says {}",
                    decoded.channels(),
                    info.samples
                )));
            }
            // Baseline JPEG is 8-bit by definition; a dataset claiming 16 Bits
            // Allocated for one still reads samples two bytes apart, so widen.
            let samples = decoded.take_data_as_u8();
            if bytes_per_sample == 1 {
                samples
            } else {
                samples.iter().flat_map(|v| [*v, 0]).collect()
            }
        }
        CompressedCodec::RleLossless => decode_rle_lossless(
            &encoded,
            (width as usize) * (height as usize),
            info.samples as usize,
            bytes_per_sample,
        )?,
    };

    Ok(bytes)
}

/// Pixel Data stored as words (OW): the tag every integer frame is read as.
const PIXEL_DATA: u32 = 0x7fe0_0010;

/// The rescaled output sample of every raw 8- or 16-bit code: `read_sample`'s
/// value times Rescale Slope plus Intercept, as f32 — exactly what the
/// per-sample path computes, so looking samples up changes no value. None
/// for other widths.
fn rescaled_lut(info: &DicomImageInfo, little: bool) -> Option<Vec<f32>> {
    let codes: u32 = match info.bits_allocated {
        8 => 256,
        16 => 65536,
        _ => return None,
    };
    let mut lut = Vec::with_capacity(codes as usize);
    for code in 0..codes {
        #[allow(clippy::cast_possible_truncation)] // code < 2^16, and < 2^8 for bytes
        let (word, byte) = (code as u16, [code as u8]);
        let pair = if little {
            word.to_le_bytes()
        } else {
            word.to_be_bytes()
        };
        let source: &[u8] = if info.bits_allocated == 8 {
            &byte
        } else {
            &pair
        };
        let raw = read_sample(
            source,
            PIXEL_DATA,
            little,
            0,
            info.bits_allocated,
            info.bits_stored,
            info.signed,
        )
        .ok()?;
        #[allow(clippy::cast_possible_truncation)] // the f32 output is the decoder's carrier
        lut.push((raw * info.slope + info.intercept) as f32);
    }
    Some(lut)
}

/// Rescaled f32 samples of `count` integer samples stored from `bytes[start..]`
/// (`index_of` maps an output sample to its stored position, for planar
/// frames), through `rescaled_lut`. None when the widths are not 8 or 16
/// bits or the bytes are short, so the caller reads them one by one (and
/// reports the truncation the usual way).
fn rescaled_samples(
    info: &DicomImageInfo,
    bytes: &[u8],
    start: usize,
    count: usize,
    little: bool,
    index_of: impl Fn(usize) -> usize,
) -> Option<Vec<f32>> {
    let width = (info.bits_allocated / 8) as usize;
    let end = count.checked_mul(width)?.checked_add(start)?;
    if end > bytes.len() {
        return None;
    }
    let lut = rescaled_lut(info, little)?;
    let stored = &bytes[start..end];
    Some(if width == 1 {
        (0..count)
            .map(|i| lut[usize::from(stored[index_of(i)])])
            .collect()
    } else {
        (0..count)
            .map(|i| {
                let at = index_of(i) * 2;
                let pair = [stored[at], stored[at + 1]];
                let code = if little {
                    u16::from_le_bytes(pair)
                } else {
                    u16::from_be_bytes(pair)
                };
                lut[usize::from(code)]
            })
            .collect()
    })
}

/// The general path: each sample through `read_sample`, then rescaled.
fn rescale(raw: &[f64], info: &DicomImageInfo) -> Vec<f32> {
    #[allow(clippy::cast_possible_truncation)] // the f32 output is the decoder's carrier
    raw.iter()
        .map(|&r| (r * info.slope + info.intercept) as f32)
        .collect()
}

/// Inflate a Deflated Explicit VR Little Endian dataset (transfer syntax
/// 1.2.840.10008.1.2.1.99), returning the file meta group followed by the
/// inflated body. `None` for every other transfer syntax, and for a stream
/// that does not inflate — a truncated file should reach the parser and get
/// its usual error, not a decompression one.
fn inflate_deflated_dataset(data: &[u8]) -> Option<Vec<u8>> {
    use std::io::Read;

    if !(data.len() >= 132 && ascii(data, 128, 4) == "DICM") {
        return None;
    }
    let mut offset = 132usize;
    let mut deflated = false;
    while offset
        .checked_add(8)
        .map(|e| e <= data.len())
        .unwrap_or(false)
    {
        let el = dicom_element(data, offset, true, true)?;
        if el.group != 0x0002 {
            break;
        }
        if el.tag == 0x0002_0010 {
            deflated = trim_dicom_string(&ascii(data, el.value_offset, el.length as usize))
                == "1.2.840.10008.1.2.1.99";
        }
        offset = el.value_offset.checked_add(el.length as usize)?;
    }
    if !deflated || offset >= data.len() {
        return None;
    }

    let mut body = Vec::new();
    flate2::read::DeflateDecoder::new(&data[offset..])
        .read_to_end(&mut body)
        .ok()?;
    let mut out = Vec::with_capacity(offset + body.len());
    out.extend_from_slice(&data[..offset]);
    out.extend_from_slice(&body);
    Some(out)
}

/// Decode one DICOM frame — native (uncompressed) or compressed (JPEG
/// Baseline / RLE Lossless) Pixel Data alike. Patient-identifying tags are
/// not retained.
pub(crate) fn decode_dicom_impl(
    data: &[u8],
    frame_index: u32,
) -> Result<ScientificParsed, DecodeError> {
    // Deflated Explicit VR stores the dataset as one deflate stream; every
    // offset below is into the inflated form.
    let inflated = inflate_deflated_dataset(data);
    let data = inflated.as_deref().unwrap_or(data);

    let context = parse_dicom_context(data)?;
    let info = dicom_image_info(&context)?;
    let safe_frame = frame_index.min(info.frames.saturating_sub(1));

    let sample_count = (info.columns as usize)
        .checked_mul(info.rows as usize)
        .and_then(|v| v.checked_mul(info.samples as usize))
        .ok_or_else(|| DecodeError::new("DICOM: dimensions overflow"))?;
    let (mut output, photometric) = if let Some(codec) = context.encoding.compressed {
        let bytes = decode_own_codec_frame(&context, &info, safe_frame, codec)?;
        let output =
            if let Some(output) = rescaled_samples(&info, &bytes, 0, sample_count, true, |i| i) {
                output
            } else {
                let width = (info.bits_allocated / 8) as usize;
                let mut raw = Vec::with_capacity(sample_count);
                for index in 0..sample_count {
                    raw.push(read_sample(
                        &bytes,
                        PIXEL_DATA,
                        true,
                        index * width,
                        info.bits_allocated,
                        info.bits_stored,
                        info.signed,
                    )?);
                }
                rescale(&raw, &info)
            };
        // Baseline JPEG stores colour as YCbCr and the decoder converts it, so
        // what comes back is RGB whatever the dataset declared. Every other
        // codec here carries no colour transform of its own, so the dataset's
        // own photometric still describes the samples.
        let photometric = if matches!(
            codec,
            CompressedCodec::JpegBaseline | CompressedCodec::JpegXl
        ) && info.samples == 3
            && info.photometric.starts_with("YBR")
        {
            "RGB".to_string()
        } else {
            info.photometric.clone()
        };
        (output, photometric)
    } else {
        let output = native_rescaled_samples(&context, &info, safe_frame, sample_count)
            .map_or_else(
                || decode_native_frame(&context, &info, safe_frame).map(|raw| rescale(&raw, &info)),
                Ok,
            )?;
        (output, info.photometric.clone())
    };

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
