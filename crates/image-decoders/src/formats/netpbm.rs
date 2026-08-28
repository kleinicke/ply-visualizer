//! NetPBM (PBM/PGM/PPM) decoder — ASCII (P1/P2/P3) and binary (P4/P5/P6).
//!
//! Bit-exact port of `PpmProcessor._parsePpm` in
//! `media/modules/ppm-processor.ts`. Two deliberately separate header
//! readers are preserved: `read_token` (whitespace/`#`-comment skipping,
//! then reads up to the next whitespace/comment) for the magic number and
//! ASCII raster values, and `read_number` (digit-only, stops at the first
//! non-digit) for width/height/maxval — the fix that prevents a missing
//! single whitespace before binary raster data from being swallowed into the
//! header fields. Do not merge them.

use crate::DecodeError;
use crate::DecodedArray;

fn is_ws(b: u8) -> bool {
    b == 32 || b == 9 || b == 10 || b == 13
}

fn skip_ws_and_comments(bytes: &[u8], offset: &mut usize) {
    while *offset < bytes.len() {
        let c = bytes[*offset];
        if c == 35 {
            // '#' comment - skip to end of line
            while *offset < bytes.len() && bytes[*offset] != 10 {
                *offset += 1;
            }
            if *offset < bytes.len() {
                *offset += 1;
            }
        } else if is_ws(c) {
            *offset += 1;
        } else {
            break;
        }
    }
}

/// Whitespace/comment-skipping token reader used for the magic number and
/// ASCII raster values.
fn read_token(bytes: &[u8], offset: &mut usize) -> String {
    skip_ws_and_comments(bytes, offset);
    let start = *offset;
    while *offset < bytes.len() {
        let c = bytes[*offset];
        if is_ws(c) || c == 35 {
            break;
        }
        *offset += 1;
    }
    bytes[start..*offset].iter().map(|&b| b as char).collect()
}

/// Digit-only header field reader for width/height/maxval. See module docs.
fn read_number(bytes: &[u8], offset: &mut usize) -> Option<i64> {
    skip_ws_and_comments(bytes, offset);
    let start = *offset;
    while *offset < bytes.len() && bytes[*offset].is_ascii_digit() {
        *offset += 1;
    }
    if *offset == start {
        return None;
    }
    std::str::from_utf8(&bytes[start..*offset])
        .ok()?
        .parse::<i64>()
        .ok()
}

/// Loose `parseInt(str, 10)`, matching JS semantics: leading sign then a run
/// of digits, stopping at (not rejecting on) the first non-digit. `None`
/// mirrors JS `NaN`.
fn parse_int_js(s: &str) -> Option<i64> {
    let bytes = s.as_bytes();
    let mut i = 0;
    let n = bytes.len();
    let mut sign: i64 = 1;
    if i < n && (bytes[i] == b'+' || bytes[i] == b'-') {
        if bytes[i] == b'-' {
            sign = -1;
        }
        i += 1;
    }
    let digits_start = i;
    while i < n && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == digits_start {
        return None;
    }
    s[digits_start..i].parse::<i64>().ok().map(|v| v * sign)
}

enum PixelData {
    U8(Vec<u8>),
    U16(Vec<u16>),
}

pub(crate) fn decode_ppm_impl(
    data: &[u8],
    compute_stats: bool,
) -> Result<DecodedArray, DecodeError> {
    let mut offset = 0usize;

    let magic = read_token(data, &mut offset);
    if !matches!(magic.as_str(), "P1" | "P2" | "P3" | "P4" | "P5" | "P6") {
        return Err(DecodeError::new(&format!(
            "Invalid PPM/PGM/PBM magic number: {}",
            magic
        )));
    }

    let is_ascii = matches!(magic.as_str(), "P1" | "P2" | "P3");
    let channels: usize = if matches!(magic.as_str(), "P1" | "P4" | "P2" | "P5") {
        1
    } else {
        3
    };
    let format = match magic.as_str() {
        "P1" => "PBM (ASCII)",
        "P2" => "PGM (ASCII)",
        "P3" => "PPM (ASCII)",
        "P4" => "PBM (Binary)",
        "P5" => "PGM (Binary)",
        _ => "PPM (Binary)",
    };
    let is_pbm = matches!(magic.as_str(), "P1" | "P4");

    let width = read_number(data, &mut offset).unwrap_or(0);
    let height = read_number(data, &mut offset).unwrap_or(0);
    let maxval = if is_pbm {
        1
    } else {
        read_number(data, &mut offset).unwrap_or(0)
    };

    if width <= 0 || height <= 0 || (!is_pbm && maxval <= 0) {
        return Err(DecodeError::new("Invalid PPM/PGM/PBM dimensions or maxval"));
    }
    let width = width as usize;
    let height = height as usize;
    let maxval = maxval as u32;

    let pixel_count = width * height;
    let total_values = pixel_count * channels;

    let use16bit = !is_pbm && maxval > 255;

    let pixel_data: PixelData;

    if is_pbm && is_ascii {
        // PBM ASCII (P1): 0/1 tokens, polarity inverted for display.
        let mut out = vec![0u8; total_values];
        for slot in out.iter_mut().take(total_values) {
            let token = read_token(data, &mut offset);
            let value = parse_int_js(&token);
            match value {
                Some(0) => *slot = 255,
                Some(1) => *slot = 0,
                _ => {
                    return Err(DecodeError::new(&format!(
                        "Invalid PBM pixel value: {} (must be 0 or 1)",
                        token
                    )))
                }
            }
        }
        pixel_data = PixelData::U8(out);
    } else if is_pbm && !is_ascii {
        // PBM binary (P4): packed bits, MSB-first, rows padded to byte boundary.
        if offset < data.len() && is_ws(data[offset]) {
            offset += 1;
        }

        let bytes_per_row = (width + 7) / 8;
        let expected_bytes = bytes_per_row * height;
        if offset + expected_bytes > data.len() {
            return Err(DecodeError::new("Insufficient data for binary PBM"));
        }

        let mut out = vec![0u8; total_values];
        let mut data_idx = 0usize;
        for row in 0..height {
            for col in 0..width {
                let byte_idx = offset + row * bytes_per_row + col / 8;
                let bit_idx = 7 - (col % 8);
                let bit = (data[byte_idx] >> bit_idx) & 1;
                out[data_idx] = if bit == 0 { 255 } else { 0 };
                data_idx += 1;
            }
        }
        pixel_data = PixelData::U8(out);
    } else if is_ascii {
        // ASCII PGM/PPM (P2/P3): space-separated values, validated against maxval.
        if use16bit {
            let mut out = vec![0u16; total_values];
            for slot in out.iter_mut().take(total_values) {
                let token = read_token(data, &mut offset);
                let value = parse_int_js(&token);
                match value {
                    Some(v) if v >= 0 && (v as u32) <= maxval => {
                        *slot = v as u16;
                    }
                    _ => return Err(DecodeError::new(&format!("Invalid pixel value: {}", token))),
                }
            }
            pixel_data = PixelData::U16(out);
        } else {
            let mut out = vec![0u8; total_values];
            for slot in out.iter_mut().take(total_values) {
                let token = read_token(data, &mut offset);
                let value = parse_int_js(&token);
                match value {
                    Some(v) if v >= 0 && (v as u32) <= maxval => {
                        *slot = v as u8;
                    }
                    _ => return Err(DecodeError::new(&format!("Invalid pixel value: {}", token))),
                }
            }
            pixel_data = PixelData::U8(out);
        }
    } else {
        // Binary PGM/PPM (P5/P6): single optional whitespace separator, then
        // raw samples (16-bit values are big-endian).
        if offset < data.len() && is_ws(data[offset]) {
            offset += 1;
        }

        let bytes_per_value = if use16bit { 2 } else { 1 };
        let expected_bytes = total_values * bytes_per_value;
        if offset + expected_bytes > data.len() {
            return Err(DecodeError::new("Insufficient data for binary PPM/PGM"));
        }

        if use16bit {
            let mut out = vec![0u16; total_values];
            let raster = &data[offset..offset + expected_bytes];
            for (slot, bytes) in out.iter_mut().zip(raster.chunks_exact(2)) {
                *slot = u16::from_be_bytes([bytes[0], bytes[1]]);
            }
            pixel_data = PixelData::U16(out);
        } else {
            pixel_data = PixelData::U8(data[offset..offset + expected_bytes].to_vec());
        }
    }

    let (data_u8, data_u16) = match pixel_data {
        PixelData::U8(v) => (v, Vec::new()),
        PixelData::U16(v) => (Vec::new(), v),
    };

    Ok(DecodedArray {
        taken: false,
        width: width as u32,
        height: height as u32,
        channels: channels as u32,
        bits_per_sample: if use16bit { 16 } else { 8 },
        sample_format: 1,
        type_min: 0.0,
        type_max: maxval as f64,
        source_numeric_type: if use16bit {
            "uint16".to_string()
        } else {
            "uint8".to_string()
        },
        sample_kind: if use16bit { 2 } else { 1 },
        format_label: format.to_string(),
        metadata_json: "{}".to_string(),
        data_f32: Vec::new(),
        data_u8,
        data_u16,
        source_data_offset: 0,
        can_reuse_source: false,
        data_min: 0.0,
        data_max: 0.0,
        non_finite_count: 0.0,
        valid_count: 0.0,
    }
    .maybe_finalize_stats(compute_stats))
}

/// Fast path for the dominant large NetPBM case. The Vec is the allocation
/// wasm-bindgen made while copying the transferred JavaScript source into
/// WASM. Move each big-endian u16 sample to the beginning of that same Vec in
/// native byte order, then return the compact prefix as carrier kind 3
/// (`native u16 bytes`). Processing forward is overlap-safe because the
/// destination always precedes the raster source by the header length.
pub(crate) fn decode_ppm_display_owned_impl(
    mut data: Vec<u8>,
) -> Result<DecodedArray, DecodeError> {
    let mut offset = 0usize;
    let magic = read_token(&data, &mut offset);
    if magic != "P5" && magic != "P6" {
        return decode_ppm_impl(&data, false);
    }
    let channels = if magic == "P6" { 3usize } else { 1usize };
    let width = read_number(&data, &mut offset).unwrap_or(0);
    let height = read_number(&data, &mut offset).unwrap_or(0);
    let maxval = read_number(&data, &mut offset).unwrap_or(0);
    if width <= 0 || height <= 0 || maxval <= 255 || maxval > 65535 {
        return decode_ppm_impl(&data, false);
    }
    if offset < data.len() && is_ws(data[offset]) {
        offset += 1;
    }
    let width = width as usize;
    let height = height as usize;
    let total_values = width
        .checked_mul(height)
        .and_then(|pixels| pixels.checked_mul(channels))
        .ok_or_else(|| DecodeError::new("PPM/PGM dimensions overflow"))?;
    let raster_bytes = total_values
        .checked_mul(2)
        .ok_or_else(|| DecodeError::new("PPM/PGM raster size overflow"))?;
    if offset
        .checked_add(raster_bytes)
        .is_none_or(|end| end > data.len())
    {
        return Err(DecodeError::new("Insufficient data for binary PPM/PGM"));
    }
    for i in 0..total_values {
        let source = offset + i * 2;
        let native = u16::from_be_bytes([data[source], data[source + 1]]).to_ne_bytes();
        data[i * 2] = native[0];
        data[i * 2 + 1] = native[1];
    }
    data.truncate(raster_bytes);

    Ok(DecodedArray {
        taken: false,
        width: width as u32,
        height: height as u32,
        channels: channels as u32,
        bits_per_sample: 16,
        sample_format: 1,
        type_min: 0.0,
        type_max: maxval as f64,
        source_numeric_type: "uint16".to_string(),
        sample_kind: 3,
        format_label: if channels == 3 {
            "PPM (Binary)"
        } else {
            "PGM (Binary)"
        }
        .to_string(),
        metadata_json: "{}".to_string(),
        data_f32: Vec::new(),
        data_u8: data,
        data_u16: Vec::new(),
        source_data_offset: 0,
        can_reuse_source: false,
        data_min: 0.0,
        data_max: 0.0,
        non_finite_count: 0.0,
        valid_count: 0.0,
    })
}

