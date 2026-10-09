//! Standalone JPEG XL files (`.jxl`).
//!
//! This lives behind a feature that `all-formats` deliberately does NOT enable.
//! jxl-rs is by far the largest decoder in the tree — folding it into the main
//! WebAssembly module grows it by well over a megabyte, which every TIFF open
//! would then pay for. The `wasm/jxl-decoder` crate builds this feature on its
//! own into a second module the webview fetches the first time a `.jxl` is
//! opened.
//!
//! What this adds over the JavaScript decoder it replaces is the sample type:
//! `@jsquash/jxl` hands back 8-bit RGBA whatever went in, so a 16-bit or float
//! JPEG XL lost its precision before the renderer ever saw it. Here the output
//! format is chosen from the file's own bit depth, so the values reaching the
//! normalization pipeline are the ones the encoder stored.

use super::json_value::{to_json_string, JsonValue};
use super::scientific_common::ScientificParsed;
use crate::DecodeError;

use jxl::api::{
    states, Endianness, JxlBitDepth, JxlColorType, JxlDataFormat, JxlDecoder, JxlDecoderOptions,
    JxlOutputBuffer, JxlPixelFormat, ProcessingResult,
};
use jxl::headers::extra_channels::ExtraChannel;

/// A bare JPEG XL codestream starts with `FF 0A`; the ISOBMFF container form
/// starts with a 12-byte JXL box signature.
pub(crate) fn is_jxl(data: &[u8]) -> bool {
    if data.len() >= 2 && data[0] == 0xff && data[1] == 0x0a {
        return true;
    }
    data.len() >= 12
        && data[..12]
            == [
                0x00, 0x00, 0x00, 0x0c, b'J', b'X', b'L', b' ', 0x0d, 0x0a, 0x87, 0x0a,
            ]
}

/// How the decoder should hand back samples, and how to describe them.
struct OutputChoice {
    format: JxlDataFormat,
    /// TIFF-style sample format: 1 = unsigned integer, 3 = IEEE float.
    sample_format: u32,
    bits_per_sample: u32,
    type_max: f64,
    source_numeric_type: &'static str,
}

/// Pick the narrowest output that still holds every stored value exactly.
///
/// Asking for f32 unconditionally would be simpler and never lose a value, but
/// it would also report every 8-bit JPEG XL as float data, which changes the
/// default normalization the viewer applies. The integer cases below are exact:
/// `U8`/`U16` with the file's own `bit_depth` reproduce the stored codes.
fn choose_output(bit_depth: &JxlBitDepth) -> OutputChoice {
    let float = |bits: u32| OutputChoice {
        format: JxlDataFormat::F32 {
            endianness: Endianness::native(),
        },
        sample_format: 3,
        bits_per_sample: bits,
        type_max: 1.0,
        source_numeric_type: "float32",
    };
    match *bit_depth {
        JxlBitDepth::Int { bits_per_sample } if (1..=8).contains(&bits_per_sample) => {
            OutputChoice {
                format: JxlDataFormat::U8 {
                    bit_depth: bits_per_sample as u8,
                },
                sample_format: 1,
                bits_per_sample,
                type_max: ((1u32 << bits_per_sample) - 1) as f64,
                source_numeric_type: "uint8",
            }
        }
        JxlBitDepth::Int { bits_per_sample } if bits_per_sample <= 16 => OutputChoice {
            format: JxlDataFormat::U16 {
                endianness: Endianness::native(),
                bit_depth: bits_per_sample as u8,
            },
            sample_format: 1,
            bits_per_sample,
            type_max: ((1u32 << bits_per_sample) - 1) as f64,
            source_numeric_type: "uint16",
        },
        // More than 16 integer bits, or any float depth: f32 is the only
        // output wide enough, and the values arrive display-referred in 0..1
        // (higher for HDR content).
        _ => float(32),
    }
}

pub(crate) fn decode_jxl_impl(data: &[u8]) -> Result<ScientificParsed, DecodeError> {
    if !is_jxl(data) {
        return Err(DecodeError::new(
            "Not a JPEG XL file (expected the FF 0A codestream or JXL box signature)",
        ));
    }

    let fail = |what: &str, e: jxl::error::Error| {
        DecodeError::new(format!("JPEG XL {} failed: {:?}", what, e))
    };
    // The whole file is in memory, so every `process` call either completes or
    // the file is truncated; there is no partial-input loop to run.
    let truncated = || DecodeError::new("JPEG XL file is truncated");

    let mut input = data;
    let decoder = JxlDecoder::<states::Initialized>::new(JxlDecoderOptions::default());
    let mut decoder = match decoder
        .process(&mut input, None)
        .map_err(|e| fail("header parsing", e))?
    {
        ProcessingResult::Complete { result } => result,
        ProcessingResult::NeedsMoreInput { .. } => return Err(truncated()),
    };

    let basic_info = decoder.basic_info().clone();
    let (width, height) = basic_info.size;
    if width == 0 || height == 0 {
        return Err(DecodeError::new("JPEG XL image has a zero dimension"));
    }

    let output = choose_output(&basic_info.bit_depth);
    let is_grayscale = decoder.current_pixel_format().color_type.is_grayscale();
    let has_alpha = basic_info
        .extra_channels
        .iter()
        .any(|c| c.ec_type == ExtraChannel::Alpha);
    let color_type = match (is_grayscale, has_alpha) {
        (true, false) => JxlColorType::Grayscale,
        (true, true) => JxlColorType::GrayscaleAlpha,
        (false, false) => JxlColorType::Rgb,
        (false, true) => JxlColorType::Rgba,
    };
    let channels = color_type.samples_per_pixel();

    // Alpha is requested through `color_type`, which interleaves it into the
    // colour buffer. Every extra channel is set to `None` (ignored) so the
    // decoder needs exactly one output buffer: alpha would otherwise be
    // delivered twice, and depth/spot channels have no place in a single
    // rendered image.
    decoder
        .set_pixel_format(JxlPixelFormat {
            color_type,
            color_data_format: Some(output.format),
            extra_channel_format: basic_info.extra_channels.iter().map(|_| None).collect(),
        })
        .map_err(|e| fail("pixel format selection", e))?;

    let decoder = match decoder
        .process(&mut input, None)
        .map_err(|e| fail("frame header parsing", e))?
    {
        ProcessingResult::Complete { result } => result,
        ProcessingResult::NeedsMoreInput { .. } => return Err(truncated()),
    };

    let bytes_per_sample = output.format.bytes_per_sample();
    let bytes_per_row = width
        .checked_mul(channels)
        .and_then(|n| n.checked_mul(bytes_per_sample))
        .ok_or_else(|| DecodeError::new("JPEG XL image is too large to decode"))?;
    let total = bytes_per_row
        .checked_mul(height)
        .ok_or_else(|| DecodeError::new("JPEG XL image is too large to decode"))?;
    // `JxlOutputBuffer` requires each row to be aligned to the sample size.
    // A `Vec<u8>` is only byte-aligned, so the buffer is allocated as `u32`
    // (the widest sample) and viewed as bytes; the rows are contiguous, so
    // aligning the start aligns them all.
    let mut words = vec![0u32; total.div_ceil(4)];
    let pixels: &mut [u8] = bytemuck_cast_mut(&mut words, total);

    {
        let mut buffers = [JxlOutputBuffer::new(pixels, height, bytes_per_row)];
        match decoder
            .process(&mut input, &mut buffers, None)
            .map_err(|e| fail("decode", e))?
        {
            ProcessingResult::Complete { result } => result,
            ProcessingResult::NeedsMoreInput { .. } => return Err(truncated()),
        };
    }

    let mut out = Vec::with_capacity(width * height * channels);
    match (output.sample_format, bytes_per_sample) {
        (3, _) => out.extend(
            pixels
                .chunks_exact(4)
                .map(|b| f32::from_ne_bytes([b[0], b[1], b[2], b[3]])),
        ),
        (_, 1) => out.extend(pixels.iter().map(|v| *v as f32)),
        (_, _) => out.extend(
            pixels
                .chunks_exact(2)
                .map(|b| u16::from_ne_bytes([b[0], b[1]]) as f32),
        ),
    }

    let metadata = vec![
        ("width".to_string(), JsonValue::Num(width as f64)),
        ("height".to_string(), JsonValue::Num(height as f64)),
        ("channels".to_string(), JsonValue::Num(channels as f64)),
        (
            "bitsPerSample".to_string(),
            JsonValue::Num(basic_info.bit_depth.bits_per_sample() as f64),
        ),
        (
            "colorType".to_string(),
            JsonValue::Str(format!("{:?}", color_type)),
        ),
        ("hasAlpha".to_string(), JsonValue::Bool(has_alpha)),
        (
            "usesOriginalProfile".to_string(),
            JsonValue::Bool(basic_info.uses_original_profile),
        ),
        (
            "isAnimation".to_string(),
            JsonValue::Bool(basic_info.animation.is_some()),
        ),
        (
            "extraChannels".to_string(),
            JsonValue::Num(basic_info.extra_channels.len() as f64),
        ),
    ];

    Ok(ScientificParsed {
        width: width as u32,
        height: height as u32,
        channels: channels as u32,
        bits_per_sample: output.bits_per_sample,
        sample_format: output.sample_format,
        type_min: 0.0,
        type_max: output.type_max,
        source_numeric_type: output.source_numeric_type.to_string(),
        metadata_json: to_json_string(&JsonValue::Obj(metadata)),
        data: out,
    })
}

/// Reinterpret a `u32` allocation as `len` bytes. Kept local rather than
/// pulling in a cast crate for one call; `u32` has no invalid bit patterns and
/// alignment only ever decreases.
fn bytemuck_cast_mut(words: &mut [u32], len: usize) -> &mut [u8] {
    debug_assert!(len <= words.len() * 4);
    // SAFETY: `u32` and `u8` are both plain data with no padding or invalid
    // values, the slice is exclusively borrowed for the returned lifetime, and
    // `len` is within the allocation by the assertion above.
    unsafe { core::slice::from_raw_parts_mut(words.as_mut_ptr().cast::<u8>(), len) }
}
