//! NumPy `.npy` / `.npz` decoder.
//!
//! Bit-exact port of `NpyProcessor._parseNpy` / `_parseNpz` in
//! `media/modules/npy-processor.ts`.
//!
//! The two implementations are held equal by `test/rust-npy-conformance-test.js`,
//! which decodes the same bytes with both and compares element-wise. Where the
//! TS had a genuine defect the fix was applied to BOTH sides together, so the
//! conformance test keeps passing and neither implementation silently drifts:
//! `>f8` (big-endian float64) used to be read little-endian, because the TS
//! decoded it through a native-endian `Float64Array` view that ignores the
//! dtype's byte-order prefix.

use super::json_value::{to_json_string, JsonValue};
use crate::DecodeError;
use crate::DecodedArray;

/// Intermediate result shared by the single-array (`.npy`) and archive
/// (`.npz`) entry points, before being assembled into `DecodedArray` by
/// `decode_npy_impl` below.
pub(crate) struct NpyParsed {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub dtype: String,
    pub bits_per_sample: u32,
    pub sample_format: u32,
    pub source_numeric_type: String,
    pub type_min: f64,
    pub type_max: f64,
    pub data: Vec<f32>,
    pub source_data_offset: Option<usize>,
    pub source_stats: Option<crate::pipeline::stats::ImageRange>,
}

/// Derives the numeric-domain fields (bits/sample_format/source_numeric_type/
/// type_min/type_max) from a numpy `dtype` string. Dispatch order mirrors
/// `read_npy_samples` exactly — it is not exact dtype matching but the same
/// `endsWith`/`includes` checks the original TS source used, in the same
/// order, so the derived numeric domain agrees with which bytes were
/// actually read.
fn numeric_info_from_dtype(dtype: &str) -> (u32, u32, String, f64, f64) {
    if dtype == "<f4" || dtype == "=f4" || dtype == ">f4" {
        return (3, 32, "float32".to_string(), 0.0, 1.0);
    }
    if dtype.ends_with("f8") {
        return (3, 64, "float64".to_string(), 0.0, 1.0);
    }
    if dtype.contains("f2") {
        return (3, 16, "float16".to_string(), 0.0, 1.0);
    }

    // Integer fallback: byte width is the LAST CHARACTER of the dtype,
    // exactly as in `read_npy_samples`.
    let width = dtype
        .chars()
        .last()
        .and_then(|c| c.to_digit(10))
        .unwrap_or(0) as usize;
    let unsigned = dtype.contains('u');
    match width {
        1 => {
            if unsigned {
                (1, 8, "uint8".to_string(), 0.0, 255.0)
            } else {
                (2, 8, "int8".to_string(), -128.0, 127.0)
            }
        }
        2 => {
            if unsigned {
                (1, 16, "uint16".to_string(), 0.0, 65535.0)
            } else {
                (2, 16, "int16".to_string(), -32768.0, 32767.0)
            }
        }
        4 => {
            if unsigned {
                (1, 32, "uint32".to_string(), 0.0, 4294967295.0)
            } else {
                (2, 32, "int32".to_string(), -2147483648.0, 2147483647.0)
            }
        }
        _ => {
            if unsigned {
                // In practice only width 8 (numpy u8/i8, i.e. 64-bit): no
                // narrower bucket applies, so report the true 64-bit range.
                (1, 64, "uint64".to_string(), 0.0, 18446744073709551615.0)
            } else {
                (
                    2,
                    64,
                    "int64".to_string(),
                    -9223372036854775808.0,
                    9223372036854775807.0,
                )
            }
        }
    }
}

const NPY_MAGIC: [u8; 6] = [0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59];
const ZIP_LOCAL_HEADER_SIG: u32 = 0x04034b50;

/// Decode either a plain `.npy` buffer or a `.npz` (ZIP) archive, dispatching
/// on the ZIP local-file-header signature in the first 4 bytes — mirroring
/// `decodeFormat`'s `case 'npy':` arm in `media/decode-worker.ts`.
pub(crate) fn decode_npy_impl(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    decode_npy_impl_with_source_reuse(data, false)
}

pub(crate) fn decode_npy_display_impl(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    decode_npy_impl_with_source_reuse(data, true)
}

fn decode_npy_impl_with_source_reuse(
    data: &[u8],
    reuse_plain_native_f32: bool,
) -> Result<DecodedArray, DecodeError> {
    let parsed = if data.len() >= 4 {
        let sig = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
        if sig == ZIP_LOCAL_HEADER_SIG {
            decode_npz(data)?
        } else {
            decode_npy_single(data, reuse_plain_native_f32)?
        }
    } else {
        decode_npy_single(data, reuse_plain_native_f32)?
    };

    let metadata_json = to_json_string(&JsonValue::Obj(vec![(
        "dtype".to_string(),
        JsonValue::Str(parsed.dtype.clone()),
    )]));

    let source_stats = parsed.source_stats;
    let decoded = DecodedArray {
        taken: false,
        width: parsed.width,
        height: parsed.height,
        channels: parsed.channels,
        bits_per_sample: parsed.bits_per_sample,
        sample_format: parsed.sample_format,
        type_min: parsed.type_min,
        type_max: parsed.type_max,
        source_numeric_type: parsed.source_numeric_type,
        sample_kind: 0,
        format_label: String::new(),
        metadata_json,
        data_f32: parsed.data,
        data_u8: Vec::new(),
        data_u16: Vec::new(),
        source_data_offset: parsed.source_data_offset.unwrap_or(0),
        can_reuse_source: parsed.source_data_offset.is_some(),
        data_min: 0.0,
        data_max: 0.0,
        non_finite_count: 0.0,
        valid_count: 0.0,
    };
    if let Some(stats) = source_stats {
        Ok(decoded.with_precomputed_range(stats))
    } else {
        Ok(decoded.finalize_stats())
    }
}

/// Loose `parseInt(str, 10)` equivalent: optional sign, then a run of ASCII
/// digits; stops at (rather than rejecting on) the first non-digit. Returns
/// `None` when there are no digits at all (JS `NaN`).
fn parse_int_js(s: &str) -> Option<i64> {
    let bytes = s.as_bytes();
    let n = bytes.len();
    let mut i = 0;
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

/// Finds `key` in `header`, skips whitespace, expects `open`, and captures
/// everything up to the first `close`. Mirrors the regexes
/// `/'shape':\s*\(([^)]+)\)/` and `/'descr':\s*'([^']+)'/`.
fn extract_group(header: &str, key: &str, open: char, close: char) -> Option<String> {
    let idx = header.find(key)?;
    let after = &header[idx + key.len()..];
    let after = after.trim_start();
    let after = after.strip_prefix(open)?;
    let end = after.find(close)?;
    Some(after[..end].to_string())
}

fn oob() -> DecodeError {
    DecodeError::new("NPY: unexpected end of data while reading samples")
}

fn get_slice<'a>(data: &'a [u8], offset: usize, len: usize) -> Result<&'a [u8], DecodeError> {
    let end = offset.checked_add(len).ok_or_else(oob)?;
    data.get(offset..end).ok_or_else(oob)
}

/// IEEE-754 half-precision -> single-precision, matching the TS
/// `float16ToFloat32` helper in `media/modules/npy-processor.ts` exactly
/// (subnormals, Inf and NaN included).
fn float16_to_f32(bits: u16) -> f32 {
    let sign = (bits >> 15) & 1;
    let exponent = (bits >> 10) & 0x1F;
    let fraction = bits & 0x03FF;
    let sign_mul: f64 = if sign != 0 { -1.0 } else { 1.0 };

    if exponent == 0 {
        if fraction == 0 {
            return if sign != 0 { -0.0f32 } else { 0.0f32 };
        }
        return (sign_mul * 2f64.powi(-14) * (fraction as f64 / 1024.0)) as f32;
    }
    if exponent == 0x1F {
        return if fraction != 0 {
            f32::NAN
        } else if sign != 0 {
            f32::NEG_INFINITY
        } else {
            f32::INFINITY
        };
    }
    (sign_mul * 2f64.powi(exponent as i32 - 15) * (1.0 + fraction as f64 / 1024.0)) as f32
}

/// Read `elems` samples of the given numpy `dtype` starting at byte `off`.
/// Dispatch order matters (see module docs / task spec) — it is not exact
/// dtype matching but the same `endsWith`/`includes` checks the TS source
/// uses, in the same order.
fn read_npy_samples(
    data: &[u8],
    off: usize,
    elems: usize,
    dtype: &str,
) -> Result<Vec<f32>, DecodeError> {
    if dtype == "<f4" || dtype == "=f4" {
        let source = get_slice(data, off, elems.saturating_mul(4))?;
        let mut out = vec![0f32; elems];
        if cfg!(target_endian = "little") {
            // Every f32 bit pattern is valid. A bulk copy is substantially
            // faster than millions of checked four-byte conversions and still
            // gives the result its own Rust-owned allocation.
            unsafe {
                std::ptr::copy_nonoverlapping(
                    source.as_ptr(),
                    out.as_mut_ptr().cast::<u8>(),
                    source.len(),
                );
            }
        } else {
            for (slot, b) in out.iter_mut().zip(source.chunks_exact(4)) {
                *slot = f32::from_le_bytes([b[0], b[1], b[2], b[3]]);
            }
        }
        return Ok(out);
    }
    if dtype == ">f4" {
        let mut out = vec![0f32; elems];
        for (i, slot) in out.iter_mut().enumerate() {
            let b = get_slice(data, off + i * 4, 4)?;
            *slot = f32::from_be_bytes([b[0], b[1], b[2], b[3]]);
        }
        return Ok(out);
    }
    if dtype.ends_with("f8") {
        let little = !dtype.starts_with('>');
        let mut out = vec![0f32; elems];
        for (i, slot) in out.iter_mut().enumerate() {
            let b = get_slice(data, off + i * 8, 8)?;
            let bytes = [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]];
            let v = if little {
                f64::from_le_bytes(bytes)
            } else {
                f64::from_be_bytes(bytes)
            };
            *slot = v as f32;
        }
        return Ok(out);
    }
    if dtype.contains("f2") {
        let little = dtype.starts_with('<') || dtype.starts_with('=');
        let mut out = vec![0f32; elems];
        for (i, slot) in out.iter_mut().enumerate() {
            let b = get_slice(data, off + i * 2, 2)?;
            let bits = if little {
                u16::from_le_bytes([b[0], b[1]])
            } else {
                u16::from_be_bytes([b[0], b[1]])
            };
            *slot = float16_to_f32(bits);
        }
        return Ok(out);
    }

    // Integer fallback: byte width is the LAST CHARACTER of the dtype.
    let width = dtype
        .chars()
        .last()
        .and_then(|c| c.to_digit(10))
        .unwrap_or(0) as usize;
    if width == 0 {
        return Err(DecodeError::new(&format!(
            "Unsupported NPY dtype {}",
            dtype
        )));
    }
    let little = dtype.starts_with('<') || dtype.starts_with('=');
    let unsigned = dtype.contains('u');
    let mut out = vec![0f32; elems];

    match width {
        1 => {
            for (i, slot) in out.iter_mut().enumerate() {
                let b = get_slice(data, off + i, 1)?;
                let v: f64 = if unsigned {
                    b[0] as f64
                } else {
                    (b[0] as i8) as f64
                };
                *slot = v as f32;
            }
        }
        2 => {
            for (i, slot) in out.iter_mut().enumerate() {
                let b = get_slice(data, off + i * 2, 2)?;
                let bb = [b[0], b[1]];
                let v: f64 = if unsigned {
                    (if little {
                        u16::from_le_bytes(bb)
                    } else {
                        u16::from_be_bytes(bb)
                    }) as f64
                } else {
                    (if little {
                        i16::from_le_bytes(bb)
                    } else {
                        i16::from_be_bytes(bb)
                    }) as f64
                };
                *slot = v as f32;
            }
        }
        4 => {
            for (i, slot) in out.iter_mut().enumerate() {
                let b = get_slice(data, off + i * 4, 4)?;
                let bb = [b[0], b[1], b[2], b[3]];
                let v: f64 = if unsigned {
                    (if little {
                        u32::from_le_bytes(bb)
                    } else {
                        u32::from_be_bytes(bb)
                    }) as f64
                } else {
                    (if little {
                        i32::from_le_bytes(bb)
                    } else {
                        i32::from_be_bytes(bb)
                    }) as f64
                };
                *slot = v as f32;
            }
        }
        _ => {
            // ANY OTHER width (in practice only 8: u8/i8 numpy dtypes) reads
            // as a 64-bit int, matching the TS `else` arm that always falls
            // through to getBigUint64/getBigInt64 — including its step size
            // of `i * width` (the declared width), not a fixed 8.
            for (i, slot) in out.iter_mut().enumerate() {
                let b = get_slice(data, off + i * width, 8)?;
                let bb = [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]];
                let v: f64 = if unsigned {
                    (if little {
                        u64::from_le_bytes(bb)
                    } else {
                        u64::from_be_bytes(bb)
                    }) as f64
                } else {
                    (if little {
                        i64::from_le_bytes(bb)
                    } else {
                        i64::from_be_bytes(bb)
                    }) as f64
                };
                *slot = v as f32;
            }
        }
    }
    Ok(out)
}

/// Decode a single `.npy` buffer (also used per-entry from `.npz`).
pub(crate) fn decode_npy_single(
    data: &[u8],
    reuse_native_f32: bool,
) -> Result<NpyParsed, DecodeError> {
    let magic = data
        .get(0..6)
        .ok_or_else(|| DecodeError::new("Invalid NPY file"))?;
    if magic != NPY_MAGIC {
        return Err(DecodeError::new("Invalid NPY file"));
    }
    let major = *data
        .get(6)
        .ok_or_else(|| DecodeError::new("Invalid NPY file"))?;
    let minor = *data
        .get(7)
        .ok_or_else(|| DecodeError::new("Invalid NPY file"))?;
    if major != 1 && major != 2 {
        return Err(DecodeError::new(&format!(
            "Unsupported NPY version {}.{}",
            major, minor
        )));
    }

    let (header_len, header_start): (usize, usize) = if major == 1 {
        let b = data
            .get(8..10)
            .ok_or_else(|| DecodeError::new("Invalid NPY file"))?;
        (u16::from_le_bytes([b[0], b[1]]) as usize, 10)
    } else {
        let b = data
            .get(8..12)
            .ok_or_else(|| DecodeError::new("Invalid NPY file"))?;
        (u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as usize, 12)
    };

    let header_bytes = data
        .get(header_start..header_start + header_len)
        .ok_or_else(|| DecodeError::new("Invalid NPY file"))?;
    // latin1: each byte maps 1:1 to the Unicode code point of the same value,
    // exactly like `TextDecoder('latin1').decode(...)`.
    let header: String = header_bytes.iter().map(|&b| b as char).collect();

    let shape_str = extract_group(&header, "'shape':", '(', ')')
        .ok_or_else(|| DecodeError::new("NPY missing shape"))?;
    let dtype = extract_group(&header, "'descr':", '\'', '\'')
        .ok_or_else(|| DecodeError::new("NPY missing dtype"))?;

    let dims: Vec<i64> = shape_str
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| parse_int_js(s).unwrap_or(0))
        .collect();

    let (sample_format, bits_per_sample, source_numeric_type, type_min, type_max) =
        numeric_info_from_dtype(&dtype);

    let (height, width, channels): (i64, i64, i64) = match dims.len() {
        2 => (dims[0], dims[1], 1),
        3 => (dims[0], dims[1], dims[2]),
        n => return Err(DecodeError::new(&format!("Unsupported NPY dims {}", n))),
    };
    if height < 0 || width < 0 || channels < 0 {
        return Err(DecodeError::new("Invalid NPY dimensions"));
    }
    let height = height as usize;
    let width = width as usize;
    let channels = channels as usize;

    let elems = width.saturating_mul(height).saturating_mul(channels);
    let off = header_start + header_len;
    let reusable_native_f32 = reuse_native_f32
        && (dtype == "<f4" || dtype == "=f4")
        && cfg!(target_endian = "little")
        && (channels == 1 || channels == 3 || channels == 4)
        && off % std::mem::align_of::<f32>() == 0
        && (data.as_ptr() as usize + off) % std::mem::align_of::<f32>() == 0;

    let (out, source_data_offset, source_stats) = if reusable_native_f32 {
        let byte_len = elems.checked_mul(4).ok_or_else(oob)?;
        let bytes = get_slice(data, off, byte_len)?;
        // SAFETY: both the base pointer + NPY raster offset and byte length were
        // checked for f32 alignment above. Native little-endian f32 is the exact
        // source representation, so the borrowed slice needs no conversion.
        let samples = unsafe { std::slice::from_raw_parts(bytes.as_ptr() as *const f32, elems) };
        let stats = crate::pipeline::stats::compute_image_range_f32(
            samples,
            width as u32,
            height as u32,
            channels as u32,
        );
        // JavaScript will create a view over its original transferred ArrayBuffer.
        // Do not allocate and populate an identical full-size Vec merely to throw it
        // away at the WASM boundary.
        (Vec::new(), Some(off), Some(stats))
    } else {
        let raw = read_npy_samples(data, off, elems, &dtype)?;
        let out = if channels == 1 || channels == 3 || channels == 4 {
            raw
        } else {
            // Any other channel count: keep only the first channel, but STILL
            // report the original `channels` value, exactly as the TS does.
            let mut o = vec![0f32; width * height];
            for (i, slot) in o.iter_mut().enumerate() {
                *slot = *raw.get(i * channels).unwrap_or(&0.0);
            }
            o
        };
        (out, None, None)
    };

    Ok(NpyParsed {
        width: width as u32,
        height: height as u32,
        channels: channels as u32,
        dtype,
        bits_per_sample,
        sample_format,
        source_numeric_type,
        type_min,
        type_max,
        data: out,
        source_data_offset,
        source_stats,
    })
}

fn read_u16_le(data: &[u8], offset: usize) -> Result<u16, DecodeError> {
    let b = get_slice(data, offset, 2)?;
    Ok(u16::from_le_bytes([b[0], b[1]]))
}

fn read_u32_le(data: &[u8], offset: usize) -> Result<u32, DecodeError> {
    let b = get_slice(data, offset, 4)?;
    Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Removes the FIRST occurrence of `from` anywhere in `s`, matching JS
/// `String.prototype.replace(from, to)` with a plain-string (non-regex,
/// non-global) argument.
fn replace_first(s: &str, from: &str) -> String {
    match s.find(from) {
        Some(idx) => {
            let mut out = String::with_capacity(s.len());
            out.push_str(&s[..idx]);
            out.push_str(&s[idx + from.len()..]);
            out
        }
        None => s.to_string(),
    }
}

fn decode_npz(data: &[u8]) -> Result<NpyParsed, DecodeError> {
    let mut offset = 0usize;
    // Ordered like a JS object: first-insertion position is kept even when a
    // later entry overwrites an existing key.
    let mut arrays: Vec<(String, NpyParsed)> = Vec::new();

    if let Some(limit) = data.len().checked_sub(4) {
        while offset < limit {
            let sig = match data.get(offset..offset + 4) {
                Some(b) => u32::from_le_bytes([b[0], b[1], b[2], b[3]]),
                None => break,
            };
            if sig != ZIP_LOCAL_HEADER_SIG {
                offset += 1;
                continue;
            }

            let flags = read_u16_le(data, offset + 6)?;
            let comp = read_u16_le(data, offset + 8)?;
            let comp_size = read_u32_le(data, offset + 18)? as usize;
            let name_len = read_u16_le(data, offset + 26)? as usize;
            let extra_len = read_u16_le(data, offset + 28)? as usize;
            let name_bytes = get_slice(data, offset + 30, name_len)?;
            let file_name = String::from_utf8_lossy(name_bytes).into_owned();
            let data_offset = offset + 30 + name_len + extra_len;

            // When general-purpose flag bit 3 is set, the local header's sizes
            // are placeholders and the real ones follow the entry in a data
            // descriptor. numpy writes such archives, with `compSize` left as 0
            // or 0xFFFFFFFF. Treating that placeholder as a real length would
            // read past the entry (and, on wasm32's 32-bit `usize`, overflow),
            // so the extent is unknown and we fall back to "rest of buffer".
            let has_data_descriptor = (flags & 0x08) != 0;
            let available = data.len().saturating_sub(data_offset);
            let size_unknown = has_data_descriptor || comp_size == 0 || comp_size == 0xFFFF_FFFF;
            let entry_size = if size_unknown {
                available
            } else {
                comp_size.min(available)
            };

            if file_name.ends_with(".npy") && comp == 0 {
                // The NPY header inside self-describes its own length, so an
                // over-long slice is harmless — trailing bytes are ignored.
                let entry_bytes = get_slice(data, data_offset, entry_size)?;
                // This offset is relative to an extracted ZIP entry rather
                // than the caller's original NPZ buffer, so it cannot be reused.
                let parsed = decode_npy_single(entry_bytes, false)?;
                let key = replace_first(&file_name, ".npy");
                match arrays.iter_mut().find(|(k, _)| k == &key) {
                    Some(existing) => existing.1 = parsed,
                    None => arrays.push((key, parsed)),
                }
            }

            // With a known size, jump straight past the entry. With an unknown
            // one, resume the byte-wise signature scan at the start of this
            // entry's data so any FOLLOWING entries are still discovered —
            // skipping to the end of the buffer would silently find only the
            // first array in a multi-entry archive. `data_offset > offset`
            // always, so the loop still makes progress.
            offset = if size_unknown {
                data_offset
            } else {
                data_offset + entry_size
            };
        }
    }

    if arrays.is_empty() {
        return Err(DecodeError::new("NPZ contains no uncompressed .npy arrays"));
    }

    let pick_idx = arrays
        .iter()
        .position(|(k, _)| {
            let lower = k.to_lowercase();
            lower.contains("depth")
                || lower.contains("dispar")
                || lower.contains("inv")
                || lower.contains('z')
                || lower.contains("range")
        })
        .unwrap_or(0);

    let mut arrays = arrays;
    let (_key, parsed) = arrays.swap_remove(pick_idx);
    Ok(parsed)
}

