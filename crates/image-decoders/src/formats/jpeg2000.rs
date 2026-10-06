//! Standalone JPEG 2000 files (`.jp2`, `.jpf`, `.jpx`, `.j2k`, `.j2c`, `.jpc`).
//!
//! The codestream is the same one TIFF carries under compression 34712 (and
//! the Aperio codes 33003/33004/33005), so the decoding is
//! `dicom_toolkit_jpeg2000`'s; what this module adds is the mapping from a
//! bare file onto the decoded-array shape every other self-describing format
//! produces.
//!
//! This exists mainly for remote sensing. Every Sentinel-2 L1C/L2A band in a
//! `.SAFE` product is a standalone 12-bit-in-16 `.jp2`, and those files have no
//! TIFF wrapper to describe them — the sample layout has to come off the
//! codestream itself.
//!
//! `decode_native` rather than `decode` is deliberate, for the same reason as
//! in the TIFF strip path: the crate's other entry point scales everything to
//! 8-bit for display, which would throw away half of a 12- or 16-bit
//! scientific image.

use super::json_value::{to_json_string, JsonValue};
use super::scientific_common::ScientificParsed;
use crate::DecodeError;

/// The JP2 signature box: a 12-byte box whose type is `jP  `.
const JP2_MAGIC: &[u8] = b"\x00\x00\x00\x0C\x6A\x50\x20\x20";
/// A raw codestream instead of a JP2 container: SOC followed by SIZ.
const CODESTREAM_MAGIC: &[u8] = b"\xFF\x4F\xFF\x51";

/// True for both spellings: the boxed JP2/JPX container and the bare
/// codestream a `.j2k`/`.j2c`/`.jpc` file holds.
pub(crate) fn is_jpeg2000(data: &[u8]) -> bool {
    data.starts_with(JP2_MAGIC) || data.starts_with(CODESTREAM_MAGIC)
}

pub(crate) fn decode_jpeg2000_impl(data: &[u8]) -> Result<ScientificParsed, DecodeError> {
    if !is_jpeg2000(data) {
        return Err(DecodeError::new(
            "Not a JPEG 2000 file (expected the JP2 signature box or an SOC/SIZ codestream)",
        ));
    }

    let settings = dicom_toolkit_jpeg2000::DecodeSettings::default();
    let image = dicom_toolkit_jpeg2000::Image::new(data, &settings)
        .map_err(|e| DecodeError::new(format!("JPEG 2000 header: {:?}", e)))?;
    let color_space = format!("{:?}", image.color_space());
    let raw = image
        .decode_native()
        .map_err(|e| DecodeError::new(format!("JPEG 2000 decode failed: {:?}", e)))?;

    let width = raw.width;
    let height = raw.height;
    let channels = raw.num_components as u32;
    // The samples are unpacked to whole bytes by `decode_native`, so the
    // storage width is what the reader must use; `bit_depth` is the codestream's
    // own precision (12 for Sentinel-2) and is what the value range comes from.
    let bit_depth = raw.bit_depth as u32;
    if channels == 0 || channels > 4 {
        return Err(DecodeError::new(format!(
            "JPEG 2000 images with {} components are not supported",
            channels
        )));
    }
    if !matches!(raw.bytes_per_sample, 1 | 2) || bit_depth == 0 || bit_depth > 16 {
        return Err(DecodeError::new(format!(
            "JPEG 2000 bit depth {} is not supported",
            bit_depth
        )));
    }

    let expected = (width as usize)
        .checked_mul(height as usize)
        .and_then(|n| n.checked_mul(channels as usize))
        .and_then(|n| n.checked_mul(raw.bytes_per_sample as usize))
        .ok_or_else(|| DecodeError::new("JPEG 2000: image dimensions overflow"))?;
    if raw.data.len() < expected {
        return Err(DecodeError::new(format!(
            "JPEG 2000: decoded {} bytes, expected {}",
            raw.data.len(),
            expected
        )));
    }

    // `decode_native` emits native-endian samples, and every target this runs
    // on is little-endian.
    let out: Vec<f32> = if raw.bytes_per_sample == 1 {
        raw.data[..expected].iter().map(|v| *v as f32).collect()
    } else {
        raw.data[..expected]
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]) as f32)
            .collect()
    };

    // A 12-bit Sentinel-2 band normalizes against 4095, not 65535: the stored
    // width is 16 bits but only `bit_depth` of them carry signal, and using the
    // storage width would render every such image at a sixteenth brightness.
    let type_max = 2f64.powi(bit_depth as i32) - 1.0;
    let source_numeric_type = if raw.bytes_per_sample == 1 {
        "uint8"
    } else {
        "uint16"
    };

    let metadata = vec![
        ("width".to_string(), JsonValue::Num(width as f64)),
        ("height".to_string(), JsonValue::Num(height as f64)),
        ("channels".to_string(), JsonValue::Num(channels as f64)),
        ("colorSpace".to_string(), JsonValue::Str(color_space)),
        (
            "bitsPerSample".to_string(),
            JsonValue::Num(bit_depth as f64),
        ),
        (
            "storageBitsPerSample".to_string(),
            JsonValue::Num((raw.bytes_per_sample as f64) * 8.0),
        ),
        (
            "container".to_string(),
            JsonValue::Str(
                if data.starts_with(JP2_MAGIC) {
                    "JP2 box structure"
                } else {
                    "raw codestream"
                }
                .to_string(),
            ),
        ),
    ];

    Ok(ScientificParsed {
        width,
        height,
        channels,
        // The reader's storage width, not the codestream precision: the caller
        // uses this to size samples, and `type_max` above already carries the
        // real precision.
        bits_per_sample: (raw.bytes_per_sample as u32) * 8,
        // Unsigned integer. `decode_native` clamps negatives to zero, so a
        // signed codestream would already have lost them by here; signed JPEG
        // 2000 is vanishingly rare outside of specialist medical data.
        sample_format: 1,
        type_min: 0.0,
        type_max,
        source_numeric_type: source_numeric_type.to_string(),
        metadata_json: to_json_string(&JsonValue::Obj(metadata)),
        data: out,
    })
}
