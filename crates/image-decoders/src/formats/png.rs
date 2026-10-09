use crate::DecodeError;
use crate::PngResult;
use std::io::Cursor;

pub(crate) fn decode_png16_impl(data: &[u8]) -> Result<PngResult, DecodeError> {
    decode_png_samples_impl(data, false)
}

pub(crate) fn decode_png_samples_impl(
    data: &[u8],
    allow_eight: bool,
) -> Result<PngResult, DecodeError> {
    let start_time = crate::time::now_ms();
    let cursor = Cursor::new(data);
    let limits = png::Limits {
        bytes: 512 * 1024 * 1024,
    };
    let decoder = png::Decoder::new_with_limits(cursor, limits);
    let mut reader = decoder
        .read_info()
        .map_err(|e| DecodeError::new(format!("Failed to read PNG info: {}", e)))?;
    let read_info_time = crate::time::now_ms() - start_time;

    let decode_start = crate::time::now_ms();
    let mut raw = vec![0u8; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut raw)
        .map_err(|e| DecodeError::new(format!("Failed to decode PNG frame: {}", e)))?;
    raw.truncate(info.buffer_size());
    let decode_time = crate::time::now_ms() - decode_start;

    if info.bit_depth != png::BitDepth::Sixteen
        && !(allow_eight && info.bit_depth == png::BitDepth::Eight)
    {
        return Err(DecodeError::new(
            "Rust PNG fast path only supports 16-bit PNG output",
        ));
    }
    let channels = match info.color_type {
        png::ColorType::Grayscale => 1,
        png::ColorType::Rgb => 3,
        png::ColorType::GrayscaleAlpha => 2,
        png::ColorType::Rgba => 4,
        png::ColorType::Indexed => {
            return Err(DecodeError::new(
                "Rust PNG fast path does not support indexed 16-bit PNG",
            ))
        }
    };

    let expected_values = (info.width as usize)
        .checked_mul(info.height as usize)
        .and_then(|v| v.checked_mul(channels as usize))
        .ok_or_else(|| DecodeError::new("PNG dimensions overflow"))?;
    let sample_bytes = if info.bit_depth == png::BitDepth::Eight {
        1
    } else {
        2
    };
    if raw.len() < expected_values * sample_bytes {
        return Err(DecodeError::new(
            "PNG decoded byte count is smaller than expected",
        ));
    }

    let convert_start = crate::time::now_ms();
    let mut values: Vec<u16> = Vec::with_capacity(expected_values);
    let src_ptr = raw.as_ptr();
    let dst = values.as_mut_ptr();
    if sample_bytes == 1 {
        values.extend(raw.iter().take(expected_values).map(|&v| v as u16));
    } else {
        for i in 0..expected_values {
            // SAFETY: `raw` was checked to contain at least `expected_values * 2`
            // bytes, and `values` has capacity for every output sample.
            unsafe {
                let be = (src_ptr.add(i * 2) as *const u16).read_unaligned();
                dst.add(i).write(u16::from_be(be));
            }
        }
        unsafe {
            values.set_len(expected_values);
        }
    }
    let convert_time = crate::time::now_ms() - convert_start;
    let total_time = crate::time::now_ms() - start_time;

    Ok(PngResult {
        width: info.width,
        height: info.height,
        channels,
        bit_depth: (sample_bytes * 8) as u32,
        color_type: png_color_type_to_u32(info.color_type),
        data_u16: values,
        timing_read_info_ms: read_info_time,
        timing_decode_ms: decode_time,
        timing_convert_ms: convert_time,
        timing_total_ms: total_time,
    })
}

fn png_color_type_to_u32(color_type: png::ColorType) -> u32 {
    match color_type {
        png::ColorType::Grayscale => 0,
        png::ColorType::Rgb => 2,
        png::ColorType::Indexed => 3,
        png::ColorType::GrayscaleAlpha => 4,
        png::ColorType::Rgba => 6,
    }
}

/// An 8-bit RGBA picture.
pub struct PngRgba8 {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// Decode a PNG to 8-bit RGBA exactly as UPNG's `toRGBA8` (the layered
/// document decoders' PNG reader) does: 16-bit samples keep their high byte,
/// palettes and `tRNS` expand to RGBA, transparency matches the full-depth
/// value. Grayscale below 8 bits (where UPNG ignores row padding),
/// interlaced images below 8 bits (UPNG misplaces 1-bit Adam7 pixels) and
/// animated PNGs are errors, and stay with UPNG.
pub(crate) fn decode_png_rgba8_impl(data: &[u8]) -> Result<PngRgba8, DecodeError> {
    let limits = png::Limits {
        bytes: 768 * 1024 * 1024,
    };
    let mut decoder = png::Decoder::new_with_limits(Cursor::new(data), limits);
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder
        .read_info()
        .map_err(|e| DecodeError::new(format!("Failed to read PNG info: {e}")))?;
    let info = reader.info();
    if info.animation_control.is_some() {
        return Err(DecodeError::new("Animated PNGs are left to UPNG"));
    }
    if (info.color_type == png::ColorType::Grayscale || info.interlaced)
        && (info.bit_depth as u8) < 8
    {
        return Err(DecodeError::new(
            "Grayscale or interlaced below 8 bits is left to UPNG",
        ));
    }
    let mut raw = vec![0u8; reader.output_buffer_size()];
    let frame = reader
        .next_frame(&mut raw)
        .map_err(|e| DecodeError::new(format!("Failed to decode PNG frame: {e}")))?;
    if frame.bit_depth != png::BitDepth::Eight {
        return Err(DecodeError::new("PNG did not expand to 8 bits"));
    }
    let pixels = (frame.width as usize)
        .checked_mul(frame.height as usize)
        .ok_or_else(|| DecodeError::new("PNG dimensions overflow"))?;
    let mut out = vec![0u8; pixels * 4];
    let take = |channels: usize| -> Result<&[u8], DecodeError> {
        raw.get(..pixels * channels)
            .ok_or_else(|| DecodeError::new("PNG decoded fewer bytes than expected"))
    };
    match frame.color_type {
        png::ColorType::Rgba => out.copy_from_slice(take(4)?),
        png::ColorType::Rgb => {
            for (pixel, rgb) in out.chunks_exact_mut(4).zip(take(3)?.chunks_exact(3)) {
                pixel[..3].copy_from_slice(rgb);
                pixel[3] = 255;
            }
        }
        png::ColorType::GrayscaleAlpha => {
            for (pixel, ga) in out.chunks_exact_mut(4).zip(take(2)?.chunks_exact(2)) {
                pixel.copy_from_slice(&[ga[0], ga[0], ga[0], ga[1]]);
            }
        }
        png::ColorType::Grayscale => {
            for (pixel, &gray) in out.chunks_exact_mut(4).zip(take(1)?) {
                pixel.copy_from_slice(&[gray, gray, gray, 255]);
            }
        }
        png::ColorType::Indexed => {
            return Err(DecodeError::new("PNG palette did not expand"));
        }
    }
    Ok(PngRgba8 {
        width: frame.width,
        height: frame.height,
        data: out,
    })
}
