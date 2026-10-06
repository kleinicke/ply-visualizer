//! Standalone JPEG XR files (`.jxr`, `.wdp`, `.hdp`).
//!
//! The codestream is the same one TIFF carries under compression 34934, so the
//! decoding is the vendored `jpegxr` crate's; what this module adds is the
//! mapping from JPEG XR's pixel formats onto the decoded-array shape every
//! other self-describing format produces.
//!
//! JPEG XR's format list is long and includes packed layouts (5:6:5, 10:10:10,
//! RGBE, fixed-point) that do not correspond to a plain sample type. Rather
//! than guess at those, this accepts the byte-aligned unsigned and float
//! formats and reports the rest by name — a wrong interpretation of a packed
//! HDR format would look plausible and be wrong, which is the failure mode
//! worth avoiding.

use super::json_value::{to_json_string, JsonValue};
use super::scientific_common::ScientificParsed;
use crate::DecodeError;

/// A JPEG XR codestream decoded to tightly packed, native-endian rows.
///
/// The vendored decoder exposes padded rows. Containers such as TIFF and CZI
/// need the padding removed before they can place the block in their own
/// raster, while the standalone decoder needs the exact same normalization
/// before converting samples to `f32`. Keeping it here prevents the three
/// callers from acquiring subtly different stride handling.
pub(crate) struct DecodedJpegXrPixels {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub bits_per_sample: u32,
    pub sample_format: jpegxr::SampleFormat,
    pub interpretation: jpegxr::PixelInterpretation,
    pub color_format: jpegxr::ColorFormat,
    pub has_alpha: bool,
    pub pixels: Vec<u8>,
}

/// The magic every JPEG XR file starts with: "II" (the format is always
/// little-endian) followed by 0xBC and the format version.
pub(crate) fn is_jpegxr(data: &[u8]) -> bool {
    data.len() >= 4 && data[0] == b'I' && data[1] == b'I' && data[2] == 0xbc
}

pub(crate) fn decode_jpegxr_pixels(
    data: &[u8],
    context: &str,
) -> Result<DecodedJpegXrPixels, DecodeError> {
    if !is_jpegxr(data) {
        return Err(DecodeError::new(
            "Not a JPEG XR file (expected the II 0xBC signature)",
        ));
    }

    let image = jpegxr::decode_bytes(data)
        .map_err(|e| DecodeError::new(format!("{}: JPEG XR decode failed: {:?}", context, e)))?;
    let format = image.pixel_format();
    let channels = format.channel_count() as u32;
    let bits_per_sample = format.bits_per_sample() as u32;
    let bytes_per_sample = (bits_per_sample as usize).div_ceil(8);
    let row_bytes = (image.width() as usize)
        .checked_mul(channels as usize)
        .and_then(|v| v.checked_mul(bytes_per_sample))
        .ok_or_else(|| DecodeError::new(format!("{}: JPEG XR row size overflows", context)))?;
    let mut pixels = Vec::with_capacity(
        row_bytes
            .checked_mul(image.height() as usize)
            .ok_or_else(|| {
                DecodeError::new(format!("{}: JPEG XR image size overflows", context))
            })?,
    );
    for row in 0..image.height() as usize {
        let start = row.checked_mul(image.stride()).ok_or_else(|| {
            DecodeError::new(format!("{}: JPEG XR row offset overflows", context))
        })?;
        let end = start
            .checked_add(row_bytes)
            .filter(|end| *end <= image.pixels().len())
            .ok_or_else(|| {
                DecodeError::new(format!("{}: JPEG XR row {} is short", context, row))
            })?;
        pixels.extend_from_slice(&image.pixels()[start..end]);
    }

    Ok(DecodedJpegXrPixels {
        width: image.width(),
        height: image.height(),
        channels,
        bits_per_sample,
        sample_format: format.sample_format(),
        interpretation: format.interpretation(),
        color_format: format.color_format(),
        has_alpha: format.has_alpha(),
        pixels,
    })
}

pub(crate) fn decode_jpegxr_impl(data: &[u8]) -> Result<ScientificParsed, DecodeError> {
    let decoded = decode_jpegxr_pixels(data, "JPEG XR")?;
    let width = decoded.width;
    let height = decoded.height;
    let channels = decoded.channels;
    let bits_per_sample = decoded.bits_per_sample;
    let sample_format = match decoded.sample_format {
        jpegxr::SampleFormat::UnsignedInteger => 1,
        jpegxr::SampleFormat::FloatingPoint => 3,
        // Unspecified/FixedPoint/Other: the samples are not plain integers or
        // IEEE floats, so reading them as either would invent values.
        other => {
            return Err(DecodeError::new(format!(
                "JPEG XR sample format {:?} is not supported",
                other
            )))
        }
    };
    // Everything below reads whole bytes per sample; a packed format (5:6:5,
    // 10:10:10, RGBE) would need unpacking this does not do.
    if !matches!(bits_per_sample, 8 | 16 | 32) || channels == 0 || channels > 4 {
        return Err(DecodeError::new(format!(
            "JPEG XR pixel format {:?} ({} channels, {} bits per sample) is not supported",
            decoded.color_format, channels, bits_per_sample
        )));
    }
    if sample_format == 3 && bits_per_sample != 32 {
        return Err(DecodeError::new(
            "JPEG XR half-float pixel formats are not supported",
        ));
    }

    let bytes_per_sample = (bits_per_sample / 8) as usize;
    let samples_per_row = (width as usize) * (channels as usize);
    let row_bytes = samples_per_row * bytes_per_sample;
    let pixels = decoded.pixels;

    let mut out = Vec::with_capacity(samples_per_row * height as usize);
    for row in 0..height as usize {
        let start = row * row_bytes;
        let end = start + row_bytes;
        let row = &pixels[start..end];
        // The decoder writes samples in the machine's byte order, and every
        // target this runs on is little-endian.
        match (sample_format, bytes_per_sample) {
            (3, 4) => out.extend(
                row.chunks_exact(4)
                    .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])),
            ),
            (_, 1) => out.extend(row.iter().map(|v| *v as f32)),
            (_, 2) => out.extend(
                row.chunks_exact(2)
                    .map(|b| u16::from_le_bytes([b[0], b[1]]) as f32),
            ),
            (_, _) => out.extend(
                row.chunks_exact(4)
                    .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f32),
            ),
        }
    }

    let (type_min, type_max) = match sample_format {
        3 => (0.0, 1.0),
        _ => (0.0, 2f64.powi(bits_per_sample as i32) - 1.0),
    };
    let source_numeric_type = match (sample_format, bits_per_sample) {
        (3, _) => "float32",
        (_, 8) => "uint8",
        (_, 16) => "uint16",
        (_, _) => "uint32",
    };

    let metadata = vec![
        ("width".to_string(), JsonValue::Num(width as f64)),
        ("height".to_string(), JsonValue::Num(height as f64)),
        ("channels".to_string(), JsonValue::Num(channels as f64)),
        (
            "colorFormat".to_string(),
            JsonValue::Str(format!("{:?}", decoded.color_format)),
        ),
        (
            "photometricInterpretation".to_string(),
            JsonValue::Str(format!("{:?}", decoded.interpretation)),
        ),
        (
            "bitsPerSample".to_string(),
            JsonValue::Num(bits_per_sample as f64),
        ),
        ("hasAlpha".to_string(), JsonValue::Bool(decoded.has_alpha)),
    ];

    Ok(ScientificParsed {
        width,
        height,
        channels,
        bits_per_sample,
        sample_format,
        type_min,
        type_max,
        source_numeric_type: source_numeric_type.to_string(),
        metadata_json: to_json_string(&JsonValue::Obj(metadata)),
        data: out,
    })
}
