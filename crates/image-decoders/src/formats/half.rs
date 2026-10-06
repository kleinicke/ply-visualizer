//! IEEE 754 binary16 -> binary32.
//!
//! Written out rather than pulling in `half`, which would otherwise be an
//! indirect dependency only. Kept in its own module because it is needed by
//! both the TIFF strip decoders and the microscopy formats, and there is no
//! feature that both of those imply — the previous arrangement had a copy on
//! each side, and the copies disagreed on subnormals.

/// Convert a binary16 bit pattern to the f32 with the same value.
///
/// Unused in a build that enables neither TIFF nor a microscopy format; the
/// module is ungated so both sides share one implementation.
///
/// Exact in every case: binary32 covers binary16's whole range and precision,
/// so no rounding is involved.
#[inline]
#[cfg_attr(
    not(any(feature = "tiff", feature = "nd2", feature = "lif")),
    allow(dead_code)
)]
pub(crate) fn f16_to_f32(bits: u16) -> f32 {
    let sign = ((bits >> 15) as u32) << 31;
    let exponent = ((bits >> 10) & 0x1f) as u32;
    let mantissa = (bits & 0x03ff) as u32;
    if exponent == 0 {
        if mantissa == 0 {
            return f32::from_bits(sign);
        }
        // A binary16 subnormal is `mantissa * 2^-24`, with no implicit leading
        // one. Shifting the mantissa left until bit 10 is set gives
        // `m = mantissa << k`, so the value is `(m / 1024) * 2^(-14 - k)` and
        // the binary32 biased exponent is `127 - 14 - k`.
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
mod tests {
    use super::f16_to_f32;

    /// Every one of the 65536 bit patterns, against the arithmetic definition
    /// rather than another implementation: a subnormal is `mantissa * 2^-24`,
    /// a normal is `(1 + mantissa/1024) * 2^(exponent - 15)`. Both are exactly
    /// representable in binary32, so any difference at all is a bug.
    ///
    /// Subnormals are why this is exhaustive. They only occur below 6.1e-5, so
    /// a wrong renormalization survives ordinary image data untouched — the
    /// second copy of this function, since deleted, had an off-by-one there
    /// that no fixture reached until a sine pattern crossed zero.
    #[test]
    fn every_bit_pattern_matches_the_definition() {
        for bits in 0u32..=0xffff {
            let bits = bits as u16;
            let sign = if bits >> 15 == 1 { -1.0f32 } else { 1.0 };
            let exponent = (bits >> 10) & 0x1f;
            let mantissa = (bits & 0x3ff) as f32;
            let got = f16_to_f32(bits);
            if exponent == 31 {
                if mantissa == 0.0 {
                    assert!(got.is_infinite() && got.signum() == sign, "0x{:04x}", bits);
                } else {
                    assert!(got.is_nan(), "0x{:04x} should be NaN", bits);
                }
                continue;
            }
            let expected = if exponent == 0 {
                sign * mantissa * 2.0f32.powi(-24)
            } else {
                sign * (1.0 + mantissa / 1024.0) * 2.0f32.powi(exponent as i32 - 15)
            };
            assert_eq!(got, expected, "0x{:04x}", bits);
            assert_eq!(
                got.is_sign_negative(),
                expected.is_sign_negative(),
                "0x{:04x}: sign of zero must be preserved",
                bits,
            );
        }
    }

    /// A handful of named values, so a failure says which property broke.
    #[test]
    fn matches_ieee_reference_values() {
        assert_eq!(f16_to_f32(0x0000), 0.0);
        assert_eq!(f16_to_f32(0x8000).to_bits(), (-0.0f32).to_bits());
        assert_eq!(f16_to_f32(0x3c00), 1.0);
        assert_eq!(f16_to_f32(0xbc00), -1.0);
        assert_eq!(f16_to_f32(0x4000), 2.0);
        assert_eq!(f16_to_f32(0x3555), 0.33325195); // nearest half to 1/3
        assert_eq!(f16_to_f32(0x7bff), 65504.0); // largest finite half
        assert_eq!(f16_to_f32(0x0400), 6.1035156e-5); // smallest normal
        assert_eq!(f16_to_f32(0x0001), 5.9604645e-8); // smallest subnormal
        assert_eq!(f16_to_f32(0x03ff), 6.097_555e-5); // largest subnormal
        assert!(f16_to_f32(0x7c00).is_infinite() && f16_to_f32(0x7c00) > 0.0);
        assert!(f16_to_f32(0xfc00).is_infinite() && f16_to_f32(0xfc00) < 0.0);
        assert!(f16_to_f32(0x7e00).is_nan());
    }
}
