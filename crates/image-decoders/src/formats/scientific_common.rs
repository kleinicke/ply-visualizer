//! Shared types/helpers for the FITS (`fits.rs`) and NetCDF (`netcdf.rs`)
//! decoders, mirroring `ScientificDecodedImage`, `finiteNumber` and
//! `scaledDomain` in `media/modules/scientific-format-parsers.ts`. Wrapped
//! into the public `DecodedArray` by `lib.rs`.

// Several helpers below serve only the container formats. A NARROW build —
// `jxl`, `jpegxr`, or `sdt` on their own — pulls this module in for its shared
// types and
// leaves the rest unused. That is expected; it is not dead code to delete.
#![cfg_attr(
    not(any(
        feature = "fits",
        feature = "netcdf",
        feature = "dicom",
        feature = "czi",
        feature = "nd2",
        feature = "lif"
    )),
    allow(dead_code)
)]

use crate::DecodeError;

/// Intermediate result shared by the FITS and NetCDF entry points, before
/// being assembled into the public `DecodedArray` in `lib.rs`.
pub(crate) struct ScientificParsed {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub bits_per_sample: u32,
    pub sample_format: u32,
    pub type_min: f64,
    pub type_max: f64,
    pub source_numeric_type: String,
    pub metadata_json: String,
    pub data: Vec<f32>,
}

/// `Math.min(first, last)` / `max` of `offset + scale * storedMin/Max` —
/// mirrors the TS `scaledDomain` helper exactly.
pub(crate) fn scaled_domain(
    stored_min: f64,
    stored_max: f64,
    scale: f64,
    offset: f64,
) -> (f64, f64) {
    let first = offset + scale * stored_min;
    let last = offset + scale * stored_max;
    (first.min(last), first.max(last))
}

/// Loose JS `Number(str)` equivalent: a FULL-STRING (not prefix) parse,
/// matching JS coercion semantics closely enough for the ASCII numeric
/// literals FITS/NetCDF headers actually contain (plain decimals, optional
/// sign/exponent). Empty/whitespace-only strings are `0` (as in JS); anything
/// that fails to parse is `NaN`. Unlike JS, this does not understand
/// `0x`/`0o`/`0b` prefixes — not a real-world concern for these formats'
/// header text.
pub(crate) fn js_number(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

/// Lenient byte-range-to-latin1-string reader: each byte maps 1:1 to the
/// Unicode code point of the same value (like `TextDecoder('latin1')` or JS
/// `String.fromCharCode` over raw bytes). Clamps to the available length
/// instead of erroring, mirroring the TS `ascii()` helper exactly (it is
/// deliberately permissive; callers that need a hard bounds check perform one
/// separately when they actually read binary values).
pub(crate) fn ascii(bytes: &[u8], start: usize, length: usize) -> String {
    if start >= bytes.len() {
        return String::new();
    }
    let end = bytes.len().min(start.saturating_add(length));
    bytes[start..end].iter().map(|&b| b as char).collect()
}

fn oob_generic(context: &str) -> DecodeError {
    DecodeError::new(format!(
        "{}: unexpected end of data while reading samples",
        context
    ))
}

/// Bounds-checked slice read, matching the "throw on out-of-range access"
/// behavior of a JS `DataView` getter (which is where the TS parsers get
/// their own implicit bounds checking).
pub(crate) fn get_slice<'a>(
    data: &'a [u8],
    offset: usize,
    len: usize,
    context: &str,
) -> Result<&'a [u8], DecodeError> {
    let end = offset
        .checked_add(len)
        .ok_or_else(|| oob_generic(context))?;
    data.get(offset..end).ok_or_else(|| oob_generic(context))
}

/// `Math.ceil(n / 4) * 4`, computed with checked arithmetic (no usize
/// overflow on 32-bit wasm targets, no panics on adversarial sizes).
#[allow(dead_code)] // absent from narrow TIFF+DICOM+JXL builds
pub(crate) fn ceil4(n: usize) -> usize {
    n.checked_add(3).map(|v| v / 4 * 4).unwrap_or(usize::MAX)
}
