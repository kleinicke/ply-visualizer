mod cmyk;
mod codecs;
mod orientation;
pub(crate) mod strips;
pub(crate) mod tags;

use crate::pipeline::stats::{
    compute_stats_f32, compute_stats_f64, compute_stats_i16, compute_stats_i32, compute_stats_i64,
    compute_stats_i8, compute_stats_u16, compute_stats_u32, compute_stats_u64, compute_stats_u8,
    convert_u16_to_bytes_simd,
};
use crate::{demosaic, TiffResult};
use cmyk::convert_cmyk_to_rgb;
use codecs::{decode_ccitt, decode_jpeg_ycbcr, decode_palette, decode_sgilog, decode_ycbcr_subsampled, unpack_bilevel};
use orientation::{apply_orientation, TiffOrientation};
use strips::{
    decode_zstd, try_decode_float_predictor_strips, try_decode_general_strips_tiles,
    try_decode_subbit_strips, try_decode_uncompressed_strips,
};
use tags::{extract_ome_xml, extract_page_tags_json};

use crate::DecodeError;
use std::io::Cursor;
use tiff::decoder::{Decoder, DecodingResult};

/// Total sample element count (width * height * channels) actually held by a
/// decoded raster, regardless of which typed variant it came back as.
fn decoding_result_len(result: &DecodingResult) -> usize {
    match result {
        DecodingResult::U8(v) => v.len(),
        DecodingResult::U16(v) => v.len(),
        DecodingResult::U32(v) => v.len(),
        DecodingResult::U64(v) => v.len(),
        DecodingResult::I8(v) => v.len(),
        DecodingResult::I16(v) => v.len(),
        DecodingResult::I32(v) => v.len(),
        DecodingResult::I64(v) => v.len(),
        DecodingResult::F32(v) => v.len(),
        DecodingResult::F64(v) => v.len(),
        DecodingResult::F16(v) => v.len(),
    }
}

/// Shared post-decode finalization for the decode paths that produce their
/// own complete `TiffResult` early (`decode_ccitt`, `decode_jpeg_ycbcr`,
/// `decode_palette`) rather than flowing through `decode_tiff_impl`'s main
/// pipeline: CMYK->RGB conversion (a no-op unless `photometric_interpretation`
/// is 5 - none of the three callers ever produce genuine 4-sample CMYK data,
/// but the call is kept uniform so a future photometric-interpretation fix-up
/// only needs to be added once) followed by the Orientation tag transform.
/// `data` is always plain one-byte-per-sample interleaved bytes for these
/// callers (CCITT/palette are already 8-bit grayscale/RGB, JPEG-YCbCr is
/// decoded straight to 8-bit RGB), so `bytes_per_pixel` doubles as the sample
/// stride here, unlike the main pipeline's `data_bytes` where it can be a
/// packed multi-byte sample width. Returns the finalized buffer plus the
/// (possibly transposed) width/height and (possibly CMYK-converted) channel
/// count. `decode_tiff_impl`'s own main pipeline applies the same two
/// building blocks (`convert_cmyk_to_rgb` / `apply_orientation`) itself
/// rather than through this helper, since its CMYK step has to run on typed
/// samples before they are packed into bytes/f32 (see the comment there).
pub(crate) fn finalize_decode_bytes(
    data: Vec<u8>,
    width: u32,
    height: u32,
    channels: u32,
    photometric_interpretation: u32,
    orientation: TiffOrientation,
) -> (Vec<u8>, u32, u32, u32) {
    let (data, channels) = if photometric_interpretation == 5 {
        match convert_cmyk_to_rgb(DecodingResult::U8(data), channels) {
            (DecodingResult::U8(converted), converted_channels) => (converted, converted_channels),
            _ => unreachable!("convert_cmyk_to_rgb preserves the U8 variant for U8 input"),
        }
    } else {
        (data, channels)
    };

    if orientation == TiffOrientation::TopLeft {
        return (data, width, height, channels);
    }
    let pixel_count = (width as usize) * (height as usize);
    let bytes_per_pixel = if pixel_count > 0 {
        data.len() / pixel_count
    } else {
        0
    };
    if bytes_per_pixel == 0 {
        return (data, width, height, channels);
    }
    let (oriented, w, h) =
        apply_orientation(&data, width, height, bytes_per_pixel as u32, orientation);
    (oriented, w, h, channels)
}

pub(crate) fn decode_tiff_impl(
    data: &[u8],
    compute_stats: bool,
    page_index: u32,
) -> Result<TiffResult, DecodeError> {
    let start_time = crate::time::now_ms();

    // CFA (Bayer) files declare PhotometricInterpretation 32803, which the tiff
    // crate refuses in Decoder::new. Their pixels are an ordinary single-channel
    // plane, so decode against a copy that says BlackIsZero and put the real
    // value back afterwards -- the webview keys CFA auto-detection off it.
    let cfa_patched = demosaic::neutralize_cfa_photometric(data);
    let data: &[u8] = cfa_patched.as_deref().unwrap_or(data);
    let cfa_photometric = cfa_patched.as_ref().map(|_| demosaic::PHOTOMETRIC_CFA);

    // SGI Log HDR (photometric 32844/32845) is refused by the tiff crate in
    // `Decoder::new`, exactly like CFA above, so it is detected from the raw
    // IFD and decoded against a copy whose photometric says BlackIsZero. Only
    // the tag plumbing comes from the crate; the samples are decoded by
    // `decode_sgilog`, which owns both the run-length layer and the log
    // luminance conversion.
    {
        let photometric_raw = raw_tag_u32(data, page_index, 262).unwrap_or(1);
        let compression_raw = raw_tag_u32(data, page_index, 259).unwrap_or(1);
        if matches!(photometric_raw, 32844 | 32845) && matches!(compression_raw, 34676 | 34677) {
            let mut patched = data.to_vec();
            if patch_photometric_to_grayscale(&mut patched, page_index) {
                let mut sgi_decoder = Decoder::new(Cursor::new(patched.as_slice()))
                    .map_err(|e| DecodeError::new(&format!("SGI Log TIFF: decoder init: {}", e)))?
                    .with_limits(tiff::decoder::Limits::unlimited());
                for _ in 0..page_index {
                    sgi_decoder
                        .next_image()
                        .map_err(|e| DecodeError::new(&format!("SGI Log TIFF: page select: {}", e)))?;
                }
                let (w, h) = sgi_decoder.dimensions().map_err(|e| {
                    DecodeError::new(&format!("SGI Log TIFF: dimensions: {}", e))
                })?;
                let orientation_tag = TiffOrientation::from_tag(
                    sgi_decoder.get_tag_u32(tiff::tags::Tag::Orientation).unwrap_or(1),
                );
                let mut result = decode_sgilog(
                    data,
                    &mut sgi_decoder,
                    w,
                    h,
                    compression_raw,
                    photometric_raw,
                    orientation_tag,
                )?;
                result.all_tags_json = extract_page_tags_json(data, page_index);
                result.ome_xml = extract_ome_xml(data);
                return Ok(result);
            }
        }
    }

    let cursor = Cursor::new(data);
    // The tiff crate's default limits cap a decoded buffer at 256 MiB, which
    // rejects ordinary large scientific rasters outright: a 10240x10240
    // float32 image needs 400 MB and fails with "decoder limits exceeded",
    // silently demoting the file to the geotiff.js fallback. Those defaults
    // exist to bound untrusted input; the ceiling that actually protects us
    // here is wasm32's own address space, and an over-large allocation fails
    // as a normal allocation error rather than a security problem.
    let mut decoder = Decoder::new(cursor)
        .map_err(|e| DecodeError::new(&format!("Failed to create decoder: {}", e)))?
        .with_limits(tiff::decoder::Limits::unlimited());

    for current in 0..page_index {
        if !decoder.more_images() {
            return Err(DecodeError::new(&format!(
                "TIFF page index {} is out of range (only {} page(s))",
                page_index,
                current + 1
            )));
        }
        decoder.next_image().map_err(|e| {
            DecodeError::new(&format!("Failed to select TIFF page {}: {}", page_index, e))
        })?;
    }

    let (width, height) = decoder
        .dimensions()
        .map_err(|e| DecodeError::new(&format!("Failed to get dimensions: {}", e)))?;

    // Palette (RGBPalette, PhotometricInterpretation 3) images are rejected by
    // the tiff crate's colortype()/read_image(), so handle them via a dedicated
    // index + ColorMap path before those calls error out.
    let photometric_early = decoder
        .get_tag_u32(tiff::tags::Tag::PhotometricInterpretation)
        .unwrap_or(1);
    if photometric_early == 3 {
        return decode_palette(data, width, height, page_index);
    }

    // Get color type and bits per sample
    let color_type = decoder
        .colortype()
        .map_err(|e| DecodeError::new(&format!("Failed to get color type: {}", e)))?;

    // `channels` MUST equal the actual per-pixel stride of the buffer we hand
    // back below, so SamplesPerPixel (tag 277) - not `color_type` - is the
    // authoritative source: `tiff::ColorType` only reports the samples that
    // belong to the photometric interpretation (e.g. RGB(_) => 3 num_samples())
    // and silently drops any additional "extra" samples that aren't alpha
    // (see e.g. shapes_hyper.tif: PhotometricInterpretation RGB with 4 extra
    // unspecified bands - SamplesPerPixel=7 but ColorType::RGB(_).num_samples()
    // is 3). Falling back to color_type.num_samples() only covers the rare
    // case where the tag itself is missing (default is 1 per the TIFF spec).
    let samples_per_pixel_tag = decoder
        .get_tag_u32(tiff::tags::Tag::SamplesPerPixel)
        .unwrap_or(0);
    let mut channels = if samples_per_pixel_tag > 0 {
        samples_per_pixel_tag
    } else {
        color_type.num_samples() as u32
    };
    // YCbCr strips are always converted to interleaved RGB by the tiff crate
    // (and by decode_jpeg_ycbcr below), so the buffer is 3 samples/pixel
    // regardless of what SamplesPerPixel says.
    if matches!(color_type, tiff::ColorType::YCbCr(_)) {
        channels = 3;
    }

    // Try to get bits per sample. `ColorType::bit_depth()` covers every
    // variant (including `Multiband`/`CMYKA`, which the old hand-rolled match
    // silently defaulted to 8 for), so use it directly.
    let mut bits_per_sample = color_type.bit_depth() as u32;

    // Extract metadata from decoder
    // Get compression method (default to 1 = None if not found)
    let compression = decoder
        .get_tag_u32(tiff::tags::Tag::Compression)
        .unwrap_or(1);

    // Get predictor (default to 1 = None if not found)
    let predictor = decoder.get_tag_u32(tiff::tags::Tag::Predictor).unwrap_or(1);

    // Get photometric interpretation (default to 1 = BlackIsZero if not found).
    // For a neutralized CFA file this reads the substituted BlackIsZero, which
    // is what the decode paths below should branch on; the real 32803 is put
    // back only when the result is assembled.
    let photometric_interpretation = decoder
        .get_tag_u32(tiff::tags::Tag::PhotometricInterpretation)
        .unwrap_or(1);

    // Get planar configuration (default to 1 = Chunky if not found)
    let planar_configuration = decoder
        .get_tag_u32(tiff::tags::Tag::PlanarConfiguration)
        .unwrap_or(1);

    // Orientation tag (274, default 1 = top-left / no transform). Applied as a
    // pixel-buffer transform near the end of this function (after the decode
    // path produces its final interleaved bytes/floats), and via
    // `finalize_decode_bytes` for the CCITT/JPEG-YCbCr/palette early-return
    // paths below, so it's shared by every decode path uniformly. The raw tag
    // value is preserved here for `extract_all_tags_json` to report in the
    // Metadata panel.
    let orientation = TiffOrientation::from_tag(
        decoder
            .get_tag_u32(tiff::tags::Tag::Orientation)
            .unwrap_or(1),
    );

    let rows_per_strip = decoder
        .get_tag_u32(tiff::tags::Tag::RowsPerStrip)
        .unwrap_or(height);
    let strip_byte_counts = decoder
        .get_tag_u64_vec(tiff::tags::Tag::StripByteCounts)
        .unwrap_or_default();
    let strip_count = strip_byte_counts.len() as u32;
    let strip_byte_count_total = strip_byte_counts.iter().copied().sum::<u64>();
    let strip_byte_count_max = strip_byte_counts.iter().copied().max().unwrap_or(0);
    let tile_width = decoder.get_tag_u32(tiff::tags::Tag::TileWidth).unwrap_or(0);
    let tile_length = decoder
        .get_tag_u32(tiff::tags::Tag::TileLength)
        .unwrap_or(0);
    let tile_count = decoder
        .get_tag_u64_vec(tiff::tags::Tag::TileByteCounts)
        .map(|counts| counts.len() as u32)
        .unwrap_or(0);

    // CCITT fax compressions: 2 (Modified Huffman), 3 (Group 3 / T.4) and
    // 4 (Group 4 / T.6). The tiff crate only decodes Group 4, so route all of
    // them through hayro-ccitt, which understands the TIFF encoding options.
    if compression == 2 || compression == 3 || compression == 4 {
        let offsets = decoder
            .get_tag_u64_vec(tiff::tags::Tag::StripOffsets)
            .map_err(|e| DecodeError::new(&format!("CCITT: missing StripOffsets: {}", e)))?;
        let counts = decoder
            .get_tag_u64_vec(tiff::tags::Tag::StripByteCounts)
            .map_err(|e| DecodeError::new(&format!("CCITT: missing StripByteCounts: {}", e)))?;
        // FillOrder defaults to 1 (MSB first); T4Options (tag 292) defaults to 0.
        let fill_order = decoder.get_tag_u32(tiff::tags::Tag::FillOrder).unwrap_or(1);
        let t4_options = decoder
            .get_tag_u32(tiff::tags::Tag::Unknown(292))
            .unwrap_or(0);
        // Each strip is an independent CCITT stream; default to a single strip.
        let rows_per_strip = decoder
            .get_tag_u32(tiff::tags::Tag::RowsPerStrip)
            .unwrap_or(height);
        let mut result = decode_ccitt(
            data,
            width,
            height,
            compression,
            predictor,
            photometric_interpretation,
            planar_configuration,
            &offsets,
            &counts,
            fill_order,
            t4_options,
            rows_per_strip,
            orientation,
        )?;
        result.all_tags_json = extract_page_tags_json(data, page_index);
        return Ok(result);
    }

    // JPEG-compressed YCbCr (compression 7, PhotometricInterpretation 6). The
    // tiff crate applies a YCbCr->RGB conversion on top of zune-jpeg's already
    // converted RGB output (a double conversion), which tints grayscale-stored
    // images. Decode the JPEG strips directly with zune-jpeg, which is correct.
    if compression == 7 && photometric_interpretation == 6 {
        let mut result = decode_jpeg_ycbcr(data, &mut decoder, width, height, orientation)?;
        result.all_tags_json = extract_page_tags_json(data, page_index);
        return Ok(result);
    }

    // Chroma-subsampled YCbCr under a LOSSLESS compression. The tiff crate
    // rejects any subsampling outright, and the layout is not a plain raster
    // (samples are grouped into MCU-style units), so it has to be unpacked
    // here. Old-style JPEG (6) is a separate, deprecated container and is
    // deliberately not routed here.
    if photometric_interpretation == 6 && matches!(compression, 1 | 5 | 8 | 32946) {
        let subsampling = decoder
            .get_tag_u32_vec(tiff::tags::Tag::Unknown(530))
            .unwrap_or_else(|_| vec![1, 1]);
        let subsampled = subsampling.first().copied().unwrap_or(1) > 1
            || subsampling.get(1).copied().unwrap_or(1) > 1;
        if subsampled {
            let mut result =
                decode_ycbcr_subsampled(data, &mut decoder, width, height, compression, orientation)?;
            result.all_tags_json = extract_page_tags_json(data, page_index);
            result.ome_xml = extract_ome_xml(data);
            return Ok(result);
        }
    }

    let decode_start = crate::time::now_ms();

    // Read image data (decompression happens here). ZSTD (50000) is decoded
    // with the pure-Rust ruzstd crate rather than the tiff crate's C zstd, so
    // the WASM build needs no C toolchain. The decompressed strips are rebuilt
    // into an uncompressed TIFF and handed back to the tiff crate, which still
    // performs predictor un-application and type/endianness handling.
    let mut direct_decode = false;
    let mut decode_result = if compression == 50000 {
        decode_zstd(data, &mut decoder)?
    } else if let Some(result) = try_decode_general_strips_tiles(
        data,
        &mut decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
        tile_width,
        tile_length,
    )? {
        direct_decode = true;
        result
    } else if let Some(result) = try_decode_float_predictor_strips(
        data,
        &mut decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
    )? {
        direct_decode = true;
        result
    } else if let Some(result) = try_decode_subbit_strips(
        data,
        &mut decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
    )? {
        direct_decode = true;
        result
    } else if let Some(result) = try_decode_uncompressed_strips(
        data,
        &mut decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
    )? {
        direct_decode = true;
        result
    } else {
        decoder
            .read_image()
            .map_err(|e| DecodeError::new(&format!("Failed to decode image: {}", e)))?
    };

    // The direct-decode paths above (`try_decode_general_strips_tiles`,
    // `try_decode_subbit_strips`, `try_decode_uncompressed_strips`) are
    // channel-count-agnostic and always emit exactly `channels` samples/pixel,
    // so this is a no-op for them. But the `decoder.read_image()` fallback can
    // silently *compact away* extra (non-alpha) samples down to whatever
    // `color_type.num_samples()` implies (see `Image::readout_for_size` /
    // `compact_photometric_bytes` in the tiff crate) - e.g. an RGB image with
    // extra unspecified bands only comes back with 3 samples/pixel. Re-derive
    // `channels` from the buffer we actually got so the reported stride never
    // lies about the data, per that path too.
    if !direct_decode {
        let element_count = decoding_result_len(&decode_result);
        let pixel_count = (width as usize) * (height as usize);
        if pixel_count > 0 && element_count % pixel_count == 0 {
            let actual_channels = (element_count / pixel_count) as u32;
            if actual_channels > 0 {
                channels = actual_channels;
            }
        }
    }

    // CMYK (PhotometricInterpretation 5): both direct-decode paths above and
    // the `read_image()` fallback hand back raw C,M,Y,K (or C,M,Y,K,A)
    // samples untouched. The webview render pipeline only understands
    // grayscale/RGB(A), so without this it treats 4-sample CMYK as RGBA -
    // wrong colors, and the K (black) channel misread as alpha (dark areas
    // turn transparent). Convert to RGB(A) once here, shared by every decode
    // path, and re-derive `channels` from the conversion's actual output
    // rather than assuming 3. `photometric_interpretation` reported in
    // TiffResult/metadata below is intentionally left as the raw tag value
    // (5) - only the pixel data changes.
    if photometric_interpretation == 5 {
        let (converted, converted_channels) = convert_cmyk_to_rgb(decode_result, channels);
        decode_result = converted;
        channels = converted_channels;
    }

    let decompress_time = crate::time::now_ms() - decode_start;
    let convert_start = crate::time::now_ms();
    let mut stats_time = 0.0;
    let mut pack_time = 0.0;

    // Determine sample format and convert data to bytes
    let (mut data_bytes, mut data_f32, sample_format, min_val, max_val) = match decode_result {
        DecodingResult::U8(data) => {
            if bits_per_sample == 1 {
                // Uncompressed (or LZW/PackBits/Deflate) bilevel images are
                // returned as MSB-first packed bits with each row padded to a
                // byte boundary. Expand to one byte per pixel so they render
                // like any other 8-bit grayscale image.
                let pack_start = crate::time::now_ms();
                let expanded = unpack_bilevel(&data, width, height, photometric_interpretation);
                bits_per_sample = 8;
                pack_time += crate::time::now_ms() - pack_start;
                let (min, max) = if compute_stats {
                    let stats_start = crate::time::now_ms();
                    let stats = compute_stats_u8(&expanded);
                    stats_time += crate::time::now_ms() - stats_start;
                    (stats.0 as f64, stats.1 as f64)
                } else {
                    (f64::NAN, f64::NAN)
                };
                (expanded, Vec::new(), 1u32, min, max)
            } else {
                let (min, max) = if compute_stats {
                    let stats_start = crate::time::now_ms();
                    let stats = compute_stats_u8(&data);
                    stats_time += crate::time::now_ms() - stats_start;
                    (stats.0 as f64, stats.1 as f64)
                } else {
                    (f64::NAN, f64::NAN)
                };
                (data, Vec::new(), 1u32, min, max)
            }
        }
        DecodingResult::U16(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_u16(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            // SIMD-optimized byte conversion
            let pack_start = crate::time::now_ms();
            let bytes = convert_u16_to_bytes_simd(&data);
            pack_time += crate::time::now_ms() - pack_start;
            (bytes, Vec::new(), 1u32, min, max)
        }
        DecodingResult::U32(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_u32(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let bytes: Vec<u8> = data.iter().flat_map(|&v| v.to_le_bytes()).collect();
            pack_time += crate::time::now_ms() - pack_start;
            (bytes, Vec::new(), 1u32, min, max)
        }
        DecodingResult::U64(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_u64(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let bytes: Vec<u8> = data.iter().flat_map(|&v| v.to_le_bytes()).collect();
            pack_time += crate::time::now_ms() - pack_start;
            (bytes, Vec::new(), 1u32, min, max)
        }
        DecodingResult::I8(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_i8(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let ubytes: Vec<u8> = data.iter().map(|&v| v as u8).collect();
            pack_time += crate::time::now_ms() - pack_start;
            (ubytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::I16(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_i16(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let bytes: Vec<u8> = data.iter().flat_map(|&v| v.to_le_bytes()).collect();
            pack_time += crate::time::now_ms() - pack_start;
            (bytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::I32(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_i32(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let bytes: Vec<u8> = data.iter().flat_map(|&v| v.to_le_bytes()).collect();
            pack_time += crate::time::now_ms() - pack_start;
            (bytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::I64(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_i64(&data);
                stats_time += crate::time::now_ms() - stats_start;
                (stats.0 as f64, stats.1 as f64)
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let bytes: Vec<u8> = data.iter().flat_map(|&v| v.to_le_bytes()).collect();
            pack_time += crate::time::now_ms() - pack_start;
            (bytes, Vec::new(), 2u32, min, max)
        }
        DecodingResult::F32(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_f32(&data);
                stats_time += crate::time::now_ms() - stats_start;
                stats
            } else {
                (f64::NAN, f64::NAN)
            };
            (Vec::new(), data, 3u32, min, max)
        }
        DecodingResult::F64(data) => {
            let (min, max) = if compute_stats {
                let stats_start = crate::time::now_ms();
                let stats = compute_stats_f64(&data);
                stats_time += crate::time::now_ms() - stats_start;
                stats
            } else {
                (f64::NAN, f64::NAN)
            };
            let pack_start = crate::time::now_ms();
            let mut values = Vec::with_capacity(data.len());
            for &val in &data {
                values.push(val as f32);
            }
            pack_time += crate::time::now_ms() - pack_start;
            (Vec::new(), values, 3u32, min, max)
        }
        DecodingResult::F16(data) => {
            // Convert f16 to f32 for processing and pre-allocate
            let pack_start = crate::time::now_ms();
            let mut values = Vec::with_capacity(data.len());
            let mut min_val = f32::INFINITY;
            let mut max_val = f32::NEG_INFINITY;

            if compute_stats {
                for &val in &data {
                    let f32_val = val.to_f32();
                    if f32_val < min_val {
                        min_val = f32_val;
                    }
                    if f32_val > max_val {
                        max_val = f32_val;
                    }
                    values.push(f32_val);
                }
            } else {
                for &val in &data {
                    values.push(val.to_f32());
                }
            }
            pack_time += crate::time::now_ms() - pack_start;
            let min = if compute_stats {
                min_val as f64
            } else {
                f64::NAN
            };
            let max = if compute_stats {
                max_val as f64
            } else {
                f64::NAN
            };
            (Vec::new(), values, 3u32, min, max)
        }
    };

    // Orientation tag (274): apply here, once, to whichever final buffer the
    // decode path produced (bytes for integer samples, f32 for float) - this
    // is after bilevel unpacking above so every buffer at this point is a
    // plain one-sample-per-element interleaved raster, regardless of which
    // decode path produced it. `bytes_per_pixel` is measured from the actual
    // buffer rather than trusted from `bits_per_sample`, since sub-16-bit
    // direct-decoded samples (9-15 bit) are packed as 2 bytes/sample even
    // though `bits_per_sample` reports the true (smaller) bit depth.
    let (width, height) = if orientation == TiffOrientation::TopLeft {
        (width, height)
    } else if !data_bytes.is_empty() {
        let pixel_count = (width as usize) * (height as usize);
        let bytes_per_pixel = if pixel_count > 0 {
            data_bytes.len() / pixel_count
        } else {
            0
        };
        if bytes_per_pixel > 0 {
            let (oriented, w, h) = apply_orientation(
                &data_bytes,
                width,
                height,
                bytes_per_pixel as u32,
                orientation,
            );
            data_bytes = oriented;
            (w, h)
        } else {
            (width, height)
        }
    } else if !data_f32.is_empty() {
        let (oriented, w, h) = apply_orientation(&data_f32, width, height, channels, orientation);
        data_f32 = oriented;
        (w, h)
    } else {
        (width, height)
    };

    let convert_time = crate::time::now_ms() - convert_start;
    let total_time = crate::time::now_ms() - start_time;
    let metadata_time = total_time - decompress_time - convert_time;

    let result = Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample,
        sample_format,
        compression,
        predictor,
        // Report the file's real CFA tag, not the BlackIsZero we substituted.
        photometric_interpretation: cfa_photometric.unwrap_or(photometric_interpretation),
        planar_configuration,
        rows_per_strip,
        strip_count,
        strip_byte_count_total,
        strip_byte_count_max,
        tile_width,
        tile_length,
        tile_count,
        direct_decode,
        data: data_bytes,
        data_f32,
        min_value: min_val,
        max_value: max_val,
        timing_metadata_ms: metadata_time,
        timing_decode_ms: decompress_time,
        timing_convert_ms: convert_time,
        timing_stats_ms: stats_time,
        timing_pack_ms: pack_time,
        all_tags_json: extract_page_tags_json(data, page_index),
        ome_xml: extract_ome_xml(data),
    });

    result
}

/// Rewrite one IFD's PhotometricInterpretation (tag 262) from
/// RGBPalette (3) to BlackIsZero (1), in place, so the tiff crate will decode
/// the raw palette indices instead of refusing the image. Returns false (and
/// leaves the buffer untouched) for anything it does not understand, e.g.
/// BigTIFF.

/// Read one SHORT/LONG tag straight out of the IFD, without the tiff crate.
///
/// Needed for photometric interpretations the crate rejects in `Decoder::new`:
/// by the time construction has failed there is no decoder to ask, so the
/// dispatch has to know what the file is beforehand.
pub(crate) fn raw_tag_u32(data: &[u8], page_index: u32, want: u16) -> Option<u32> {
    if data.len() < 8 {
        return None;
    }
    let le = match &data[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };
    let rd16 = |b: &[u8]| if le { u16::from_le_bytes([b[0], b[1]]) } else { u16::from_be_bytes([b[0], b[1]]) };
    let rd32 = |b: &[u8]| {
        if le { u32::from_le_bytes([b[0], b[1], b[2], b[3]]) } else { u32::from_be_bytes([b[0], b[1], b[2], b[3]]) }
    };
    if rd16(data.get(2..4)?) != 42 {
        return None; // classic TIFF only; BigTIFF falls back
    }
    let mut ifd = rd32(data.get(4..8)?) as usize;
    for _ in 0..page_index {
        let count = rd16(data.get(ifd..ifd + 2)?) as usize;
        let next = ifd + 2 + count * 12;
        ifd = rd32(data.get(next..next + 4)?) as usize;
        if ifd == 0 {
            return None;
        }
    }
    let count = rd16(data.get(ifd..ifd + 2)?) as usize;
    for i in 0..count {
        let at = ifd + 2 + i * 12;
        if rd16(data.get(at..at + 2)?) != want {
            continue;
        }
        let field_type = rd16(data.get(at + 2..at + 4)?);
        let value = data.get(at + 8..at + 12)?;
        return Some(match field_type {
            3 => rd16(value) as u32, // SHORT: left-justified in the value field
            4 => rd32(value),
            _ => return None,
        });
    }
    None
}

pub(crate) fn patch_photometric_to_grayscale(buf: &mut [u8], page_index: u32) -> bool {
    if buf.len() < 8 {
        return false;
    }
    let le = match &buf[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return false,
    };
    let rd16 = |b: &[u8]| {
        if le {
            u16::from_le_bytes([b[0], b[1]])
        } else {
            u16::from_be_bytes([b[0], b[1]])
        }
    };
    let rd32 = |b: &[u8]| {
        if le {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        }
    };
    // Only classic TIFF (magic 42) is handled; BigTIFF (43) is left to fall back.
    if rd16(&buf[2..4]) != 42 {
        return false;
    }
    let mut ifd = rd32(&buf[4..8]) as usize;
    for _ in 0..page_index {
        if ifd + 2 > buf.len() {
            return false;
        }
        let count = rd16(&buf[ifd..ifd + 2]) as usize;
        let next_offset_pos = ifd + 2 + count * 12;
        if next_offset_pos + 4 > buf.len() {
            return false;
        }
        ifd = rd32(&buf[next_offset_pos..next_offset_pos + 4]) as usize;
        if ifd == 0 {
            return false;
        }
    }
    if ifd + 2 > buf.len() {
        return false;
    }
    let count = rd16(&buf[ifd..ifd + 2]) as usize;
    for i in 0..count {
        let e = ifd + 2 + i * 12;
        if e + 12 > buf.len() {
            return false;
        }
        if rd16(&buf[e..e + 2]) == 262 {
            // SHORT value stored inline in the entry's value field.
            let one = if le { [1u8, 0u8] } else { [0u8, 1u8] };
            buf[e + 8] = one[0];
            buf[e + 9] = one[1];
            return true;
        }
    }
    false
}

/// Parse just enough of `data` to describe a predictor-3 float strip layout.
/// Used by the strip-parallel entry points in the crate root.
pub(crate) fn float_strip_plan_for(data: &[u8]) -> Option<strips::FloatStripPlan> {
    let mut decoder = Decoder::new(Cursor::new(data)).ok()?;
    let (width, height) = decoder.dimensions().ok()?;
    let color_type = decoder.colortype().ok()?;
    let channels = match color_type {
        tiff::ColorType::Gray(_) => 1,
        tiff::ColorType::GrayA(_) => 2,
        tiff::ColorType::RGB(_) => 3,
        tiff::ColorType::RGBA(_) | tiff::ColorType::CMYK(_) => 4,
        _ => return None,
    };
    let bits_per_sample = decoder
        .get_tag_u64_vec(tiff::tags::Tag::BitsPerSample)
        .ok()
        .and_then(|v| v.first().copied())
        .unwrap_or(0) as u32;
    let compression = decoder
        .get_tag_u64(tiff::tags::Tag::Compression)
        .unwrap_or(1) as u32;
    let predictor = decoder
        .get_tag_u64(tiff::tags::Tag::Predictor)
        .unwrap_or(1) as u32;
    let planar_configuration = decoder
        .get_tag_u64(tiff::tags::Tag::PlanarConfiguration)
        .unwrap_or(1) as u32;
    // The strip-parallel path returns raw samples with no post-processing, so
    // anything decode_tiff_impl would transform afterwards must disqualify the
    // file here: orientation flips, CMYK->RGB, palette expansion and CFA all
    // rewrite the pixels, and reproducing them per strip would duplicate logic
    // that is only correct on the whole image.
    let photometric = decoder
        .get_tag_u64(tiff::tags::Tag::PhotometricInterpretation)
        .unwrap_or(1) as u32;
    if photometric != 1 && photometric != 2 {
        return None;
    }
    let orientation = decoder.get_tag_u64(tiff::tags::Tag::Orientation).unwrap_or(1);
    if orientation != 1 {
        return None;
    }
    if decoder.get_tag_u64_vec(tiff::tags::Tag::ColorMap).is_ok() {
        return None;
    }
    if demosaic::neutralize_cfa_photometric(data).is_some() {
        return None;
    }
    strips::float_predictor_plan(
        data,
        &mut decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
    )
}

/// Metadata for a strip-parallel decode: everything the worker result needs
/// that the strip plan does not already carry. Deliberately does NOT decode
/// pixels — the strip workers produce those.
pub(crate) struct StripMetadata {
    pub page_count: u32,
    pub photometric_interpretation: u32,
    pub all_tags_json: String,
    pub ome_xml: String,
}

pub(crate) fn strip_metadata_for(data: &[u8]) -> Result<StripMetadata, DecodeError> {
    let cfa_patched = demosaic::neutralize_cfa_photometric(data);
    let raw: &[u8] = cfa_patched.as_deref().unwrap_or(data);
    let mut decoder = Decoder::new(Cursor::new(raw))
        .map_err(|e| DecodeError::new(&format!("Failed to create decoder: {}", e)))?
        .with_limits(tiff::decoder::Limits::unlimited());
    let mut page_count = 1u32;
    while decoder.more_images() {
        if decoder.next_image().is_err() {
            break;
        }
        page_count += 1;
    }
    let mut decoder = Decoder::new(Cursor::new(raw))
        .map_err(|e| DecodeError::new(&format!("Failed to create decoder: {}", e)))?
        .with_limits(tiff::decoder::Limits::unlimited());
    let photometric_interpretation = decoder
        .get_tag_u64(tiff::tags::Tag::PhotometricInterpretation)
        .unwrap_or(1) as u32;
    Ok(StripMetadata {
        page_count,
        photometric_interpretation,
        all_tags_json: extract_page_tags_json(data, 0),
        ome_xml: extract_ome_xml(data),
    })
}

