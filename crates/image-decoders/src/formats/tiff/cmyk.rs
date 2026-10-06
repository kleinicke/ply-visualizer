use tiff::decoder::DecodingResult;

/// Naive, uncalibrated CMYK -> RGB conversion (no ICC profile applied):
/// `R = (max-C)*(max-K)/max`, and likewise for G/B from M/Y. `max` is the
/// full-scale value for the sample's numeric range (2^bits-1 for integer
/// data, 1.0 for float data already stored in a normalized 0..1 range).
fn cmyk_to_rgb_f64(c: f64, m: f64, y: f64, k: f64, max: f64) -> (f64, f64, f64) {
    if max <= 0.0 {
        return (0.0, 0.0, 0.0);
    }
    let r = (max - c) * (max - k) / max;
    let g = (max - m) * (max - k) / max;
    let b = (max - y) * (max - k) / max;
    (r, g, b)
}

/// Convert CMYK (4 samples/pixel) or CMYKA (5 samples/pixel) interleaved
/// pixel data to RGB / RGBA, sharing the same conversion regardless of which
/// decode path (`try_decode_uncompressed_strips`, `try_decode_general_strips_tiles`,
/// or the `decoder.read_image()` fallback) produced `result` - all of them
/// hand back raw, unconverted C,M,Y,K(,A) samples. A CMYKA alpha sample is
/// passed through unchanged (not treated as a fifth color channel). Sample
/// kinds this doesn't have a defined conversion for (signed integers, 64-bit
/// float/int) are passed through unconverted - CMYK TIFFs in practice are
/// unsigned-integer or float32.
pub(crate) fn convert_cmyk_to_rgb(result: DecodingResult, channels: u32) -> (DecodingResult, u32) {
    if channels != 4 && channels != 5 {
        return (result, channels);
    }
    let has_alpha = channels == 5;
    let out_channels = if has_alpha { 4 } else { 3 };
    let stride = channels as usize;

    macro_rules! convert_int {
        ($data:expr, $max:expr) => {{
            let max = $max as f64;
            let pixel_count = $data.len() / stride;
            let mut out = Vec::with_capacity(pixel_count * out_channels as usize);
            for px in $data.chunks_exact(stride) {
                let (r, g, b) =
                    cmyk_to_rgb_f64(px[0] as f64, px[1] as f64, px[2] as f64, px[3] as f64, max);
                out.push(r.round().clamp(0.0, max) as _);
                out.push(g.round().clamp(0.0, max) as _);
                out.push(b.round().clamp(0.0, max) as _);
                if has_alpha {
                    out.push(px[4]);
                }
            }
            out
        }};
    }

    match result {
        DecodingResult::U8(data) => (
            DecodingResult::U8(convert_int!(data, u8::MAX)),
            out_channels,
        ),
        DecodingResult::U16(data) => (
            DecodingResult::U16(convert_int!(data, u16::MAX)),
            out_channels,
        ),
        DecodingResult::U32(data) => (
            DecodingResult::U32(convert_int!(data, u32::MAX)),
            out_channels,
        ),
        DecodingResult::F32(data) => {
            let pixel_count = data.len() / stride;
            let mut out = Vec::with_capacity(pixel_count * out_channels as usize);
            for px in data.chunks_exact(stride) {
                let (r, g, b) =
                    cmyk_to_rgb_f64(px[0] as f64, px[1] as f64, px[2] as f64, px[3] as f64, 1.0);
                out.push(r as f32);
                out.push(g as f32);
                out.push(b as f32);
                if has_alpha {
                    out.push(px[4]);
                }
            }
            (DecodingResult::F32(out), out_channels)
        }
        // No defined CMYK conversion for these sample kinds (signed data
        // doesn't fit the [0, max] ink-coverage model, and 64-bit CMYK TIFFs
        // aren't a thing in practice) - leave the raw samples/channel count
        // untouched rather than silently mis-converting them.
        other => (other, channels),
    }
}

/// The strip-parallel wire path operates on native sample bytes. Keep its
/// common unsigned-8 CMYK conversion anchored to the exact same implementation
/// as the whole-image decoder instead of duplicating the color math in JS.
pub(crate) fn convert_cmyk_u8_to_rgb(data: Vec<u8>, channels: u32) -> (Vec<u8>, u32) {
    match convert_cmyk_to_rgb(DecodingResult::U8(data), channels) {
        (DecodingResult::U8(converted), converted_channels) => (converted, converted_channels),
        _ => unreachable!("U8 CMYK conversion must preserve the U8 variant"),
    }
}
