//! Shared types/helpers for the FITS (`fits.rs`) and NetCDF (`netcdf.rs`)
//! decoders, mirroring `ScientificDecodedImage`, `finiteNumber` and
//! `scaledDomain` in `media/modules/scientific-format-parsers.ts`. Wrapped
//! into the public `DecodedArray` by `lib.rs`.

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
    DecodeError::new(&format!(
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
pub(crate) fn ceil4(n: usize) -> usize {
    n.checked_add(3).map(|v| v / 4 * 4).unwrap_or(usize::MAX)
}

/// IEEE 754 binary16 -> binary32.
///
/// Hand-rolled because `f16` is not stable Rust and this crate stays
/// dependency-light. Subnormals, infinities and NaN are handled explicitly
/// rather than approximated: NaN is a meaningful value in scientific data, so
/// a NaN payload is preserved rather than flattened to a quiet NaN.
pub(crate) fn f16_to_f32(bits: u16) -> f32 {
    let sign = ((bits >> 15) as u32) << 31;
    let exponent = ((bits >> 10) & 0x1f) as u32;
    let mantissa = (bits & 0x03ff) as u32;
    if exponent == 0 {
        if mantissa == 0 {
            return f32::from_bits(sign);
        }
        // A binary16 subnormal is `mantissa * 2^-24`. Shifting the mantissa
        // left until bit 10 is set gives `m = mantissa << k`, so the value is
        // `(m / 1024) * 2^(-14 - k)`; the binary32 biased exponent is
        // therefore `127 - 14 - k`, i.e. `127 - 15 + (1 - k)`.
        let mut shifts = 0i32;
        let mut m = mantissa;
        while m & 0x0400 == 0 {
            m <<= 1;
            shifts += 1;
        }
        let exp = (127 - 15 + (1 - shifts)) as u32;
        return f32::from_bits(sign | (exp << 23) | ((m & 0x03ff) << 13));
    }
    if exponent == 0x1f {
        return f32::from_bits(sign | 0x7f80_0000 | (mantissa << 13));
    }
    f32::from_bits(sign | ((exponent + 127 - 15) << 23) | (mantissa << 13))
}

#[cfg(test)]
mod f16_tests {
    use super::f16_to_f32;

    /// Reference values are the exact binary16 encodings from IEEE 754-2008.
    #[test]
    fn matches_ieee_reference_values() {
        assert_eq!(f16_to_f32(0x0000), 0.0);
        assert_eq!(f16_to_f32(0x8000).to_bits(), (-0.0f32).to_bits(), "-0 keeps its sign");
        assert_eq!(f16_to_f32(0x3c00), 1.0);
        assert_eq!(f16_to_f32(0xbc00), -1.0);
        assert_eq!(f16_to_f32(0x4000), 2.0);
        assert_eq!(f16_to_f32(0x3555), 0.33325195); // nearest half to 1/3
        assert_eq!(f16_to_f32(0x7bff), 65504.0);    // largest finite half
        assert_eq!(f16_to_f32(0x0400), 6.1035156e-5); // smallest normal
        assert_eq!(f16_to_f32(0x0001), 5.9604645e-8); // smallest subnormal
        assert_eq!(f16_to_f32(0x03ff), 6.0975552e-5); // largest subnormal
        assert!(f16_to_f32(0x7c00).is_infinite() && f16_to_f32(0x7c00) > 0.0);
        assert!(f16_to_f32(0xfc00).is_infinite() && f16_to_f32(0xfc00) < 0.0);
        assert!(f16_to_f32(0x7e00).is_nan());
    }

    /// Straight from the IEEE 754 definition, used only as the test oracle.
    fn reference(bits: u16) -> f64 {
        let sign = if bits >> 15 == 1 { -1.0 } else { 1.0 };
        let exponent = ((bits >> 10) & 0x1f) as i32;
        let mantissa = (bits & 0x03ff) as f64;
        if exponent == 0 {
            sign * mantissa * 2f64.powi(-24)
        } else {
            sign * (1.0 + mantissa / 1024.0) * 2f64.powi(exponent - 15)
        }
    }

    /// All 65536 patterns against the definition. binary32 represents every
    /// binary16 exactly, so anything but equality is a bug.
    #[test]
    fn every_bit_pattern_matches_the_definition() {
        for bits in 0u32..=0xffff {
            let bits = bits as u16;
            let exponent = (bits >> 10) & 0x1f;
            let got = f16_to_f32(bits);
            if exponent == 0x1f {
                // Inf/NaN are checked separately; only the class must match.
                assert_eq!(got.is_nan(), (bits & 0x03ff) != 0, "pattern {:#06x}", bits);
                continue;
            }
            assert_eq!(got as f64, reference(bits), "pattern {:#06x}", bits);
        }
    }
}

