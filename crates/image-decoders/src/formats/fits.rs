//! FITS (Flexible Image Transport System) decoder.
//!
//! Bit-exact port of `parseFits` and its helpers (`fitsValue`, `ascii`,
//! `finiteNumber`, `scaledDomain`) in `media/modules/scientific-format-parsers.ts`.
//! Decodes the first primary/IMAGE HDU with at least two axes, matching every
//! documented TS quirk: 80-column card parsing, `fitsValue`'s quote-escaping
//! and `/`-comment stripping, `D`/`d` -> `E` exponent rewriting before the
//! numeric parse, `T`/`F` booleans, falling back to the trimmed raw string
//! when the value isn't a finite number, BITPIX -> sample type mapping,
//! BSCALE/BZERO application, big-endian sample order, and 2880-byte block
//! padding for both the header and the data section.
//!
//! Held equal to the TS implementation by `test/rust-scientific-conformance-test.js`.

use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{ascii, get_slice, js_number, scaled_domain, ScientificParsed};
use crate::DecodeError;
use std::collections::HashMap;

/// A FITS header card value: `fitsValue()` in the TS returns
/// `string | number | boolean | null`; this is that same union.
#[derive(Clone)]
enum HeaderValue {
    Bool(bool),
    Num(f64),
    Str(String),
    Null,
}

type Header = HashMap<String, HeaderValue>;

/// JS `typeof value === 'number' ? value : Number(value)`, then
/// `Number.isFinite(...) ? parsed : fallback` — mirrors TS `finiteNumber`
/// exactly, including its quirks: a missing key (JS `undefined`) yields
/// `NaN` -> `fallback`; a `null` card value coerces to `0` (`Number(null) === 0`,
/// which IS finite); a `true`/`false` card value coerces to `1`/`0`.
fn finite_number(v: Option<&HeaderValue>, fallback: f64) -> f64 {
    match v {
        None => fallback,
        Some(HeaderValue::Num(n)) => {
            if n.is_finite() {
                *n
            } else {
                fallback
            }
        }
        Some(HeaderValue::Bool(b)) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Some(HeaderValue::Null) => 0.0,
        Some(HeaderValue::Str(s)) => {
            let n = js_number(s);
            if n.is_finite() {
                n
            } else {
                fallback
            }
        }
    }
}

/// JS truthiness of a header card value (used for `header.OBJECT || undefined`
/// and `header.XTENSION || ''`): `false`/`0`/`""`/`null`/missing are falsy.
fn truthy(v: Option<&HeaderValue>) -> bool {
    match v {
        None => false,
        Some(HeaderValue::Null) => false,
        Some(HeaderValue::Bool(b)) => *b,
        Some(HeaderValue::Num(n)) => *n != 0.0,
        Some(HeaderValue::Str(s)) => !s.is_empty(),
    }
}

fn header_value_to_json(v: &HeaderValue) -> JsonValue {
    match v {
        HeaderValue::Bool(b) => JsonValue::Bool(*b),
        HeaderValue::Num(n) => JsonValue::Num(*n),
        HeaderValue::Str(s) => JsonValue::Str(s.clone()),
        HeaderValue::Null => JsonValue::Null,
    }
}

/// JS `String(value)` for a header card value (used by the XTENSION check).
fn js_to_string(v: &HeaderValue) -> String {
    match v {
        HeaderValue::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        HeaderValue::Num(n) => super::json_value::format_number(*n),
        HeaderValue::Str(s) => s.clone(),
        HeaderValue::Null => "null".to_string(),
    }
}

/// `String(header.XTENSION || '').trim().toUpperCase()`.
fn xtension_upper(header: &Header) -> String {
    let v = header.get("XTENSION");
    let s = if truthy(v) {
        js_to_string(v.unwrap())
    } else {
        String::new()
    };
    s.trim().to_uppercase()
}

/// Removes the FIRST 'd' or 'D' character in `s`, replacing it with 'E' —
/// matches the TS `.replace(/[dD]/, 'E')` (regex without the global flag).
fn replace_first_dd(s: &str) -> String {
    match s.find(|c| c == 'd' || c == 'D') {
        Some(idx) => {
            let mut out = String::with_capacity(s.len());
            out.push_str(&s[..idx]);
            out.push('E');
            out.push_str(&s[idx + 1..]);
            out
        }
        None => s.to_string(),
    }
}

/// Parse one 80-byte FITS header card into its value. Mirrors TS `fitsValue`
/// exactly: not a `KEY     = value` card -> `Null`; otherwise strip an
/// optional trailing `/ comment` (respecting quoted strings, where `''`
/// escapes a literal quote), trim, recognize `T`/`F` as booleans, else try a
/// numeric parse (with `D`/`d` rewritten to `E` for Fortran-style exponents)
/// and fall back to the trimmed string when that parse isn't finite.
fn fits_value(card: &[u8]) -> HeaderValue {
    if card.get(8).copied() != Some(b'=') {
        return HeaderValue::Null;
    }
    let raw = if card.len() > 10 { &card[10..] } else { &[] };
    let mut quoted = false;
    let mut value = String::new();
    let mut i = 0usize;
    while i < raw.len() {
        let ch = raw[i];
        if ch == b'\'' {
            if quoted && raw.get(i + 1) == Some(&b'\'') {
                value.push('\'');
                i += 2;
                continue;
            }
            quoted = !quoted;
            i += 1;
            continue;
        }
        if ch == b'/' && !quoted {
            break;
        }
        value.push(ch as char);
        i += 1;
    }
    let value = value.trim().to_string();
    if value == "T" {
        return HeaderValue::Bool(true);
    }
    if value == "F" {
        return HeaderValue::Bool(false);
    }
    let replaced = replace_first_dd(&value);
    let numeric = js_number(&replaced);
    if !value.is_empty() && numeric.is_finite() {
        HeaderValue::Num(numeric)
    } else {
        HeaderValue::Str(value)
    }
}

/// `Math.ceil(n / 2880) * 2880`, computed on f64 (matching JS number
/// semantics exactly, and side-stepping usize overflow on 32-bit wasm for
/// adversarial header values) and only converted back to `usize` once the
/// caller has confirmed the result is a sane, in-range offset.
fn ceil_2880_f64(n: f64) -> f64 {
    (n / 2880.0).ceil() * 2880.0
}

fn read_stored(data: &[u8], offset: usize, bitpix: i64) -> Result<f64, DecodeError> {
    match bitpix {
        8 => Ok(*get_slice(data, offset, 1, "FITS")?.first().unwrap() as f64),
        16 => {
            let b = get_slice(data, offset, 2, "FITS")?;
            Ok(i16::from_be_bytes([b[0], b[1]]) as f64)
        }
        32 => {
            let b = get_slice(data, offset, 4, "FITS")?;
            Ok(i32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64)
        }
        64 => {
            let b = get_slice(data, offset, 8, "FITS")?;
            Ok(i64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]) as f64)
        }
        -32 => {
            let b = get_slice(data, offset, 4, "FITS")?;
            Ok(f32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64)
        }
        -64 => {
            let b = get_slice(data, offset, 8, "FITS")?;
            Ok(f64::from_be_bytes([
                b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
            ]))
        }
        _ => Ok(f64::NAN),
    }
}

/// Decode the first primary/IMAGE FITS HDU with at least two axes.
pub(crate) fn decode_fits_impl(data: &[u8]) -> Result<ScientificParsed, DecodeError> {
    let mut hdu_offset: usize = 0;
    let mut hdu_index: u32 = 0;
    // Collected only to explain a rejection. "No image HDU" leaves the user
    // guessing whether the file is corrupt, unsupported, or simply not an
    // image; naming what the file actually holds answers that. A FITS file
    // full of BINTABLEs (an IUE spectrum, say) is perfectly valid and will
    // never contain a picture.
    let mut hdu_kinds: Vec<String> = Vec::new();

    loop {
        if hdu_offset
            .checked_add(80)
            .map(|e| e > data.len())
            .unwrap_or(true)
        {
            break;
        }
        let mut header: Header = HashMap::new();
        let mut card_offset = hdu_offset;
        let mut found_end = false;
        while card_offset
            .checked_add(80)
            .map(|e| e <= data.len())
            .unwrap_or(false)
        {
            let card = &data[card_offset..card_offset + 80];
            card_offset += 80;
            let key = ascii(card, 0, 8);
            let key = key.trim();
            if key == "END" {
                found_end = true;
                break;
            }
            if !key.is_empty() {
                header.insert(key.to_string(), fits_value(card));
            }
        }
        if !found_end {
            return Err(DecodeError::new("Invalid FITS header: missing END card"));
        }
        let data_offset_f = ceil_2880_f64(card_offset as f64);
        let bitpix = finite_number(header.get("BITPIX"), 0.0);
        let naxis = finite_number(header.get("NAXIS"), 0.0).max(0.0);
        // FITS caps NAXIS at 999 by spec; this bound is far beyond that and
        // exists only to keep an adversarial header from spinning forever.
        let naxis_iters = (naxis as u64).min(16_384) as usize;
        let mut axes: Vec<f64> = Vec::with_capacity(naxis_iters);
        let mut element_count: f64 = if naxis > 0.0 { 1.0 } else { 0.0 };
        for i in 1..=naxis_iters {
            let key = format!("NAXIS{}", i);
            let size = finite_number(header.get(&key), 0.0).max(0.0);
            axes.push(size);
            element_count *= size;
        }
        let bytes_per_value_f = bitpix.abs() / 8.0;
        let data_bytes = element_count * bytes_per_value_f;
        let is_image = hdu_index == 0 || xtension_upper(&header) == "IMAGE";

        const SUPPORTED_BITPIX: [f64; 6] = [8.0, 16.0, 32.0, 64.0, -32.0, -64.0];
        let bitpix_supported = SUPPORTED_BITPIX.contains(&bitpix);

        // Describe this HDU in case nothing displayable turns up, so the
        // rejection can say what the file holds instead of only what it lacks.
        hdu_kinds.push({
            let extension = xtension_upper(&header);
            let kind = if !extension.is_empty() {
                extension
            } else if hdu_index == 0 {
                "primary".to_string()
            } else {
                "unknown".to_string()
            };
            if naxis < 1.0 {
                format!("HDU {hdu_index}: {kind}, header only")
            } else if is_image && !bitpix_supported {
                format!(
                    "HDU {hdu_index}: {kind}, unsupported BITPIX {}",
                    bitpix as i64
                )
            } else if naxis < 2.0 {
                format!("HDU {hdu_index}: {kind}, {naxis:.0}D")
            } else {
                format!("HDU {hdu_index}: {kind}")
            }
        });

        if is_image
            && naxis >= 2.0
            && axes.get(0).copied().unwrap_or(0.0) > 0.0
            && axes.get(1).copied().unwrap_or(0.0) > 0.0
            && bitpix_supported
        {
            let width_f = axes[0];
            let height_f = axes[1];
            let plane_values = width_f * height_f;
            if data_offset_f + plane_values * bytes_per_value_f > data.len() as f64 {
                return Err(DecodeError::new("Truncated FITS image data"));
            }
            if !(data_offset_f.is_finite()
                && data_offset_f >= 0.0
                && data_offset_f <= data.len() as f64)
            {
                return Err(DecodeError::new("Truncated FITS image data"));
            }
            let data_offset = data_offset_f as usize;
            let width = width_f as usize;
            let height = height_f as usize;

            let scale = finite_number(header.get("BSCALE"), 1.0);
            let zero = finite_number(header.get("BZERO"), 0.0);
            let blank: Option<f64> = match header.get("BLANK") {
                Some(HeaderValue::Num(n)) => Some(*n),
                _ => None,
            };
            let bits_per_sample = bitpix.abs() as u32;
            let sample_format: u32 = if bitpix < 0.0 {
                3
            } else if bitpix == 8.0 {
                1
            } else {
                2
            };
            let stored_min = if sample_format == 3 || sample_format == 1 {
                0.0
            } else {
                -(2f64.powi(bits_per_sample as i32 - 1))
            };
            let stored_max = if sample_format == 3 {
                1.0
            } else if sample_format == 1 {
                2f64.powi(bits_per_sample as i32) - 1.0
            } else {
                2f64.powi(bits_per_sample as i32 - 1) - 1.0
            };
            let (type_min, type_max) = scaled_domain(stored_min, stored_max, scale, zero);
            let source_numeric_type: &str = if sample_format == 3 {
                if bits_per_sample <= 32 {
                    "float32"
                } else {
                    "float64"
                }
            } else if sample_format == 1 {
                "uint8"
            } else if bits_per_sample <= 16 {
                "int16"
            } else {
                "int32"
            };

            let plane_pixels = width
                .checked_mul(height)
                .ok_or_else(|| DecodeError::new("FITS image dimensions overflow"))?;
            let mut out = vec![0f32; plane_pixels];
            let bpv = bytes_per_value_f as usize;
            let bitpix_i = bitpix as i64;
            for y in 0..height {
                let src_y = height - 1 - y;
                for x in 0..width {
                    let idx = src_y
                        .checked_mul(width)
                        .and_then(|v| v.checked_add(x))
                        .ok_or_else(|| DecodeError::new("FITS: index overflow"))?;
                    let byte_off = data_offset
                        .checked_add(
                            idx.checked_mul(bpv)
                                .ok_or_else(|| DecodeError::new("FITS: offset overflow"))?,
                        )
                        .ok_or_else(|| DecodeError::new("FITS: offset overflow"))?;
                    let stored = read_stored(data, byte_off, bitpix_i)?;
                    let value = match blank {
                        Some(b) if stored == b => f32::NAN,
                        _ => (zero + scale * stored) as f32,
                    };
                    out[y * width + x] = value;
                }
            }

            let first_plane_only = axes.iter().skip(2).any(|&s| s > 1.0);

            let mut fields = JsonValue::obj();
            fields.push(("format".to_string(), JsonValue::Str("FITS".to_string())));
            fields.push(("hduIndex".to_string(), JsonValue::Num(hdu_index as f64)));
            fields.push(("bitpix".to_string(), JsonValue::Num(bitpix)));
            fields.push((
                "axes".to_string(),
                JsonValue::Arr(axes.iter().map(|&a| JsonValue::Num(a)).collect()),
            ));
            fields.push(("bscale".to_string(), JsonValue::Num(scale)));
            fields.push(("bzero".to_string(), JsonValue::Num(zero)));
            let object_val = header
                .get("OBJECT")
                .filter(|v| truthy(Some(v)))
                .map(|v| header_value_to_json(v));
            push_opt(&mut fields, "object", object_val);
            let unit_val = header
                .get("BUNIT")
                .filter(|v| truthy(Some(v)))
                .map(|v| header_value_to_json(v));
            push_opt(&mut fields, "unit", unit_val);
            fields.push((
                "firstPlaneOnly".to_string(),
                JsonValue::Bool(first_plane_only),
            ));
            let metadata_json = to_json_string(&JsonValue::Obj(fields));

            return Ok(ScientificParsed {
                width: width as u32,
                height: height as u32,
                channels: 1,
                bits_per_sample,
                sample_format,
                type_min,
                type_max,
                source_numeric_type: source_numeric_type.to_string(),
                metadata_json,
                data: out,
            });
        }

        let padded_data_bytes = ceil_2880_f64(data_bytes);
        let next_offset_f = data_offset_f + padded_data_bytes;
        if !next_offset_f.is_finite()
            || next_offset_f < 0.0
            || next_offset_f > data.len() as f64 + 2880.0
        {
            break;
        }
        hdu_offset = next_offset_f as usize;
        hdu_index = hdu_index.saturating_add(1);
    }
    if hdu_kinds.is_empty() {
        return Err(DecodeError::new(
            "FITS file contains no supported 2D image HDU",
        ));
    }
    // The two reasons need different explanations. An image with a BITPIX we
    // cannot read is a gap in this decoder; a file of tables is simply not a
    // picture and never will be. Saying "holds tabular data" about the former
    // would send the reader looking for the wrong problem.
    let unsupported_depth = hdu_kinds.iter().any(|k| k.contains("unsupported BITPIX"));
    let explanation = if unsupported_depth {
        "Its image data uses a sample depth this decoder does not support."
    } else {
        "This file holds tabular or header-only data rather than an image."
    };
    Err(DecodeError::new(&format!(
        "FITS file contains no 2D image HDU (found {}). {}",
        hdu_kinds.join(", "),
        explanation
    )))
}

