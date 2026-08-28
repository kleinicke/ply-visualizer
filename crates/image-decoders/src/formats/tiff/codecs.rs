use super::orientation::TiffOrientation;
use super::tags::{extract_all_tags_json, extract_ome_xml, extract_page_tags_json};
use super::{finalize_decode_bytes, patch_photometric_to_grayscale};
use crate::pipeline::stats::compute_stats_u8;
use crate::DecodeError;
use crate::TiffResult;
use std::io::Cursor;
use tiff::decoder::{Decoder, DecodingResult};

/// Build a minimal single-strip, uncompressed classic TIFF wrapping `raster`,
/// preserving the tags the decoder needs (incl. the predictor, which the tiff
/// crate then un-applies). `raster` must be the full image in row order.
#[allow(clippy::too_many_arguments)]
pub(crate) fn build_uncompressed_tiff(
    le: bool,
    width: u32,
    height: u32,
    spp: u32,
    bits: &[u32],
    sample_format: &[u32],
    photometric: u32,
    predictor: u32,
    raster: &[u8],
) -> Vec<u8> {
    let u16b = |v: u16| if le { v.to_le_bytes() } else { v.to_be_bytes() };
    let u32b = |v: u32| if le { v.to_le_bytes() } else { v.to_be_bytes() };
    // SHORT (type 3) and LONG (type 4) tag values. Single SHORT values are
    // left-justified in the 4-byte value field; arrays are stored externally.
    let short_val = |v: u32| {
        let b = u16b(v as u16);
        [b[0], b[1], 0, 0]
    };
    let long_val = |v: u32| u32b(v);

    const N_TAGS: u16 = 12;
    let ifd_offset: u32 = 8;
    let ifd_size: u32 = 2 + (N_TAGS as u32) * 12 + 4;
    let after_ifd = ifd_offset + ifd_size;

    // BitsPerSample (258) / SampleFormat (339): a SHORT array fits inline in the
    // 4-byte value field when count <= 2; otherwise it is stored externally and
    // the value field holds the offset.
    let pack_inline = |vals: &[u32]| -> [u8; 4] {
        let mut f = [0u8; 4];
        for (i, &v) in vals.iter().enumerate().take(2) {
            let b = u16b(v as u16);
            f[2 * i] = b[0];
            f[2 * i + 1] = b[1];
        }
        f
    };
    let mut ext: Vec<u8> = Vec::new();
    let bits_field = if spp <= 2 {
        pack_inline(bits)
    } else {
        let off = after_ifd + ext.len() as u32;
        for &b in bits {
            ext.extend_from_slice(&u16b(b as u16));
        }
        u32b(off)
    };
    let sf_field = if spp <= 2 {
        pack_inline(sample_format)
    } else {
        let off = after_ifd + ext.len() as u32;
        for &s in sample_format {
            ext.extend_from_slice(&u16b(s as u16));
        }
        u32b(off)
    };
    let data_off = after_ifd + ext.len() as u32;

    let mut buf: Vec<u8> = Vec::with_capacity(data_off as usize + raster.len());
    buf.extend_from_slice(if le { b"II" } else { b"MM" });
    buf.extend_from_slice(&u16b(42));
    buf.extend_from_slice(&u32b(ifd_offset));
    buf.extend_from_slice(&u16b(N_TAGS));

    let put = |buf: &mut Vec<u8>, tag: u16, typ: u16, count: u32, valfield: [u8; 4]| {
        buf.extend_from_slice(&u16b(tag));
        buf.extend_from_slice(&u16b(typ));
        buf.extend_from_slice(&u32b(count));
        buf.extend_from_slice(&valfield);
    };

    // Tags must be in ascending order.
    put(&mut buf, 256, 4, 1, long_val(width)); // ImageWidth
    put(&mut buf, 257, 4, 1, long_val(height)); // ImageLength
    put(&mut buf, 258, 3, spp, bits_field); // BitsPerSample
    put(&mut buf, 259, 3, 1, short_val(1)); // Compression = none
    put(&mut buf, 262, 3, 1, short_val(photometric)); // PhotometricInterpretation
    put(&mut buf, 273, 4, 1, long_val(data_off)); // StripOffsets
    put(&mut buf, 277, 3, 1, short_val(spp)); // SamplesPerPixel
    put(&mut buf, 278, 4, 1, long_val(height)); // RowsPerStrip
    put(&mut buf, 279, 4, 1, long_val(raster.len() as u32)); // StripByteCounts
    put(&mut buf, 284, 3, 1, short_val(1)); // PlanarConfiguration = chunky
    put(&mut buf, 317, 3, 1, short_val(predictor)); // Predictor
    put(&mut buf, 339, 3, spp, sf_field); // SampleFormat

    buf.extend_from_slice(&u32b(0)); // next IFD offset
    buf.extend_from_slice(&ext);
    buf.extend_from_slice(raster);
    buf
}

/// Reconstruct a complete JPEG datastream from the optional shared JPEGTables
/// and one strip's image data (the TIFF Technote 2 abbreviated-stream layout):
/// a single SOI, then the tables, then the strip's frame.
fn build_jpeg(tables: Option<&[u8]>, strip: &[u8]) -> Vec<u8> {
    match tables {
        Some(t) => {
            let t = if t.ends_with(&[0xFF, 0xD9]) {
                &t[..t.len() - 2]
            } else {
                t
            };
            let s = if strip.starts_with(&[0xFF, 0xD8]) {
                &strip[2..]
            } else {
                strip
            };
            let mut out = Vec::with_capacity(t.len() + s.len());
            out.extend_from_slice(t);
            out.extend_from_slice(s);
            out
        }
        None => strip.to_vec(),
    }
}

/// Decode a JPEG-compressed YCbCr TIFF (compression 7, photometric 6) by
/// decoding each strip's JPEG directly with zune-jpeg. The tiff crate applies a
/// second YCbCr->RGB conversion on top of zune-jpeg's already-RGB output, which
/// tints the image; decoding the strips ourselves avoids that. Tiled images are
/// not handled here.
pub(crate) fn decode_jpeg_ycbcr(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    orientation: TiffOrientation,
) -> Result<TiffResult, DecodeError> {
    use tiff::tags::Tag;
    use zune_jpeg::JpegDecoder;

    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(DecodeError::new(
            "JPEG: tiled YCbCr JPEG is not supported by the direct path",
        ));
    }
    let offsets = decoder
        .get_tag_u64_vec(Tag::StripOffsets)
        .map_err(|e| DecodeError::new(&format!("JPEG: StripOffsets: {}", e)))?;
    let counts = decoder
        .get_tag_u64_vec(Tag::StripByteCounts)
        .map_err(|e| DecodeError::new(&format!("JPEG: StripByteCounts: {}", e)))?;
    // JPEGTables (tag 347): optional abbreviated table stream shared by strips.
    let tables: Option<Vec<u8>> = decoder.get_tag_u8_vec(Tag::Unknown(347)).ok();

    let mut rgb: Vec<u8> = Vec::with_capacity((width as usize).saturating_mul(height as usize) * 3);
    let mut channels = 3u32;
    for (off, cnt) in offsets.iter().zip(counts.iter()) {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > data.len() {
            return Err(DecodeError::new("JPEG: strip byte range out of bounds"));
        }
        let jpeg = build_jpeg(tables.as_deref(), &data[start..end]);
        let mut jd = JpegDecoder::new(Cursor::new(jpeg));
        let px = jd
            .decode()
            .map_err(|e| DecodeError::new(&format!("JPEG decode failed: {:?}", e)))?;
        let info = jd
            .info()
            .ok_or_else(|| DecodeError::new("JPEG: missing image info"))?;
        let pixels = (info.width as usize).saturating_mul(info.height as usize);
        if pixels == 0 {
            return Err(DecodeError::new("JPEG: empty strip"));
        }
        channels = (px.len() / pixels) as u32;
        rgb.extend_from_slice(&px);
    }
    if channels != 1 && channels != 3 {
        return Err(DecodeError::new("JPEG: unexpected channel count"));
    }

    // Data is now decoded RGB (or grayscale), never CMYK, so
    // `finalize_decode_bytes`'s CMYK step is a no-op here and only the
    // Orientation transform actually does anything.
    let photometric_interpretation = if channels == 3 { 2 } else { 1 };
    let (rgb, width, height, channels) = finalize_decode_bytes(
        rgb,
        width,
        height,
        channels,
        photometric_interpretation,
        orientation,
    );

    let (min, max) = compute_stats_u8(&rgb);
    Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample: 8,
        sample_format: 1,
        compression: 7,
        predictor: 1,
        photometric_interpretation,
        planar_configuration: 1,
        rows_per_strip: decoder.get_tag_u32(Tag::RowsPerStrip).unwrap_or(height),
        strip_count: counts.len() as u32,
        strip_byte_count_total: counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: counts.iter().copied().max().unwrap_or(0),
        tile_width: 0,
        tile_length: 0,
        tile_count: 0,
        direct_decode: false,
        data: rgb,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
        all_tags_json: extract_all_tags_json(data),
        ome_xml: extract_ome_xml(data),
    })
}

/// Expand MSB-first packed bilevel (1-bit) data to one byte per pixel.
///
/// Each row is padded to a byte boundary. Pixel polarity follows the TIFF
/// PhotometricInterpretation tag: 0 = WhiteIsZero, 1 = BlackIsZero.
pub(crate) fn unpack_bilevel(data: &[u8], width: u32, height: u32, photometric: u32) -> Vec<u8> {
    let width = width as usize;
    let height = height as usize;
    let row_bytes = (width + 7) / 8;
    let white_is_zero = photometric == 0;
    let mut out = Vec::with_capacity(width.saturating_mul(height));
    for y in 0..height {
        let row_start = y * row_bytes;
        for x in 0..width {
            let byte = data.get(row_start + x / 8).copied().unwrap_or(0);
            let bit = (byte >> (7 - (x % 8))) & 1;
            let white = if white_is_zero { bit == 0 } else { bit == 1 };
            out.push(if white { 255 } else { 0 });
        }
    }
    out
}

/// Decode a palette (RGBPalette) TIFF by reading the raw indices and expanding
/// them through the ColorMap tag into interleaved 8-bit RGB.
pub(crate) fn decode_palette(
    data: &[u8],
    width: u32,
    height: u32,
    page_index: u32,
) -> Result<TiffResult, DecodeError> {
    use tiff::tags::Tag;

    // ColorMap (tag 320): 3 * 2^bits 16-bit entries, laid out as all reds, then
    // all greens, then all blues.
    let cmap = {
        let mut d = Decoder::new(Cursor::new(data))
            .map_err(|e| DecodeError::new(&format!("Palette: decoder init: {}", e)))?;
        for _ in 0..page_index {
            d.next_image()
                .map_err(|e| DecodeError::new(&format!("Palette: page select: {}", e)))?;
        }
        d.get_tag_u16_vec(Tag::Unknown(320))
            .map_err(|e| DecodeError::new(&format!("Palette: missing ColorMap: {}", e)))?
    };
    if cmap.is_empty() || cmap.len() % 3 != 0 {
        return Err(DecodeError::new("Palette: invalid ColorMap length"));
    }
    let n_colors = cmap.len() / 3;

    // Patch the photometric tag so the tiff crate decodes the indices for us,
    // reusing all of its compression / predictor / strip handling.
    let mut patched = data.to_vec();
    if !patch_photometric_to_grayscale(&mut patched, page_index) {
        return Err(DecodeError::new("Palette: could not patch photometric tag"));
    }

    let mut d = Decoder::new(Cursor::new(patched.as_slice()))
        .map_err(|e| DecodeError::new(&format!("Palette: patched decoder init: {}", e)))?;
    for _ in 0..page_index {
        d.next_image()
            .map_err(|e| DecodeError::new(&format!("Palette: patched page select: {}", e)))?;
    }
    let compression = d.get_tag_u32(Tag::Compression).unwrap_or(1);
    let predictor = d.get_tag_u32(Tag::Predictor).unwrap_or(1);
    let planar = d.get_tag_u32(Tag::PlanarConfiguration).unwrap_or(1);
    let rows_per_strip = d.get_tag_u32(Tag::RowsPerStrip).unwrap_or(height);
    let strip_byte_counts = d.get_tag_u64_vec(Tag::StripByteCounts).unwrap_or_default();
    let tile_width = d.get_tag_u32(Tag::TileWidth).unwrap_or(0);
    let tile_length = d.get_tag_u32(Tag::TileLength).unwrap_or(0);
    let tile_count = d
        .get_tag_u64_vec(Tag::TileByteCounts)
        .map(|counts| counts.len() as u32)
        .unwrap_or(0);
    // Orientation tag (274): the early-return palette path bypasses
    // `decode_tiff_impl`'s own Orientation-tag read (it returns before that
    // point), so read it here off the same patched decoder and finalize
    // through `finalize_decode_bytes` below like every other path.
    let orientation = TiffOrientation::from_tag(d.get_tag_u32(Tag::Orientation).unwrap_or(1));

    let index_bits = d.get_tag_u32(Tag::BitsPerSample).unwrap_or(8);
    let mut indices: Vec<usize> = match d
        .read_image()
        .map_err(|e| DecodeError::new(&format!("Palette: index decode failed: {}", e)))?
    {
        DecodingResult::U8(v) => v.iter().map(|&x| x as usize).collect(),
        DecodingResult::U16(v) => v.iter().map(|&x| x as usize).collect(),
        _ => return Err(DecodeError::new("Palette: unexpected index sample type")),
    };
    // A 2- or 4-bit palette packs several indices into each byte, and the tiff
    // crate hands those bytes back unpacked. Expanding them straight into the
    // ColorMap therefore produced one pixel per BYTE — a 73-wide row became 19
    // pixels, and the image came out roughly a fifth of its true size with
    // colours read from the wrong entries. Rows are individually padded to a
    // byte boundary, so unpacking has to be done row by row.
    if index_bits < 8 && index_bits > 0 {
        let per_row = width as usize;
        let row_bytes = (per_row * index_bits as usize + 7) / 8;
        let mask = (1usize << index_bits) - 1;
        let mut unpacked = Vec::with_capacity(per_row * height as usize);
        for row in 0..height as usize {
            let start = row * row_bytes;
            let bytes = indices.get(start..start + row_bytes).unwrap_or(&[]);
            let mut bit_buf: usize = 0;
            let mut bit_count: u32 = 0;
            let mut byte_idx = 0usize;
            for _ in 0..per_row {
                while bit_count < index_bits {
                    let byte = bytes.get(byte_idx).copied().unwrap_or(0);
                    byte_idx += 1;
                    bit_buf = (bit_buf << 8) | byte;
                    bit_count += 8;
                }
                let shift = bit_count - index_bits;
                unpacked.push((bit_buf >> shift) & mask);
                bit_count -= index_bits;
                bit_buf &= if bit_count == 0 { 0 } else { (1usize << bit_count) - 1 };
            }
        }
        indices = unpacked;
    }

    // ColorMap entries are 16-bit; scale down to 8-bit per channel.
    let mut rgb = Vec::with_capacity(indices.len().saturating_mul(3));
    for &i in &indices {
        if i < n_colors {
            rgb.push((cmap[i] >> 8) as u8);
            rgb.push((cmap[n_colors + i] >> 8) as u8);
            rgb.push((cmap[2 * n_colors + i] >> 8) as u8);
        } else {
            rgb.extend_from_slice(&[0, 0, 0]);
        }
    }

    // Palette output is already expanded RGB (photometric_interpretation 2,
    // never 5/CMYK), so `finalize_decode_bytes`'s CMYK step is a no-op here
    // and only the Orientation transform actually does anything.
    let (rgb, width, height, channels) =
        finalize_decode_bytes(rgb, width, height, 3, 2, orientation);

    let (min, max) = compute_stats_u8(&rgb);
    Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample: 8,
        sample_format: 1,
        compression,
        predictor,
        photometric_interpretation: 2, // expanded to RGB
        planar_configuration: planar,
        rows_per_strip,
        strip_count: strip_byte_counts.len() as u32,
        strip_byte_count_total: strip_byte_counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: strip_byte_counts.iter().copied().max().unwrap_or(0),
        tile_width,
        tile_length,
        tile_count,
        direct_decode: false,
        data: rgb,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
        all_tags_json: extract_page_tags_json(data, page_index),
        ome_xml: extract_ome_xml(data),
    })
}

/// Decode a CCITT-fax-compressed TIFF (compression 2, 3 or 4) using hayro-ccitt.
///
/// CCITT data is bilevel; we expand it to one byte per pixel (0 = black,
/// 255 = white) and report it as an 8-bit grayscale image so it flows through
/// the same rendering path as any other integer TIFF.
#[allow(clippy::too_many_arguments)]
pub(crate) fn decode_ccitt(
    data: &[u8],
    width: u32,
    height: u32,
    compression: u32,
    predictor: u32,
    photometric_interpretation: u32,
    planar_configuration: u32,
    offsets: &[u64],
    counts: &[u64],
    fill_order: u32,
    t4_options: u32,
    rows_per_strip: u32,
    orientation: TiffOrientation,
) -> Result<TiffResult, DecodeError> {
    use hayro_ccitt::{
        decode, DecodeSettings, Decoder as CcittDecoder, DecoderContext, EncodingMode,
    };

    // Map the TIFF compression + T4Options to a hayro encoding mode.
    let two_dimensional = (t4_options & 0b1) != 0; // bit 0: 2D coding
                                                   // Compression 2 (Modified Huffman) byte-aligns every row; for Group 3 this
                                                   // is controlled by T4Options bit 2 (EncodedByteAlign).
    let byte_aligned = compression == 2 || (t4_options & 0b100) != 0;
    let encoding = match compression {
        4 => EncodingMode::Group4,
        3 if two_dimensional => EncodingMode::Group3_2D { k: u32::MAX },
        // Compression 2 (Modified Huffman) and 3 (Group 3, 1D).
        _ => EncodingMode::Group3_1D,
    };
    let end_of_line = matches!(encoding, EncodingMode::Group3_2D { .. });

    // hayro-ccitt emits a "white" pel for TIFF sample value 0 (the CCITT
    // convention). Map that to a display value through PhotometricInterpretation
    // exactly like unpack_bilevel does, so a CCITT image renders identically to
    // the same image stored uncompressed. (0 = WhiteIsZero, 1 = BlackIsZero.)
    let white_pel_value: u8 = if photometric_interpretation == 0 {
        255
    } else {
        0
    };
    let black_pel_value: u8 = 255 - white_pel_value;

    // hayro-ccitt streams decoded pixels through this collector.
    struct Collector {
        pixels: Vec<u8>,
        width: u32,
        cur_x: u32,
        white_value: u8,
        black_value: u8,
    }
    impl CcittDecoder for Collector {
        fn push_pixel(&mut self, white: bool) {
            if self.cur_x < self.width {
                self.pixels.push(if white {
                    self.white_value
                } else {
                    self.black_value
                });
                self.cur_x += 1;
            }
        }
        fn push_pixel_chunk(&mut self, white: bool, chunk_count: u32) {
            for _ in 0..(chunk_count * 8) {
                self.push_pixel(white);
            }
        }
        fn next_line(&mut self) {
            // Pad a short final run with the background (white) color so every
            // row is exactly `width` pixels.
            while self.cur_x < self.width {
                self.pixels.push(self.white_value);
                self.cur_x += 1;
            }
            self.cur_x = 0;
        }
    }

    let expected = (width as usize).saturating_mul(height as usize);
    let mut collector = Collector {
        pixels: Vec::with_capacity(expected),
        width,
        cur_x: 0,
        white_value: white_pel_value,
        black_value: black_pel_value,
    };

    // Each strip is an independent CCITT stream covering up to rows_per_strip
    // rows. Decode them one at a time (resetting the decoder per strip) and
    // accumulate the pixel rows, rather than concatenating the bitstreams.
    let rps = if rows_per_strip == 0 {
        height
    } else {
        rows_per_strip
    };
    for (i, (off, cnt)) in offsets.iter().zip(counts.iter()).enumerate() {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > data.len() {
            return Err(DecodeError::new("CCITT: strip byte range out of bounds"));
        }
        let rows_in_strip = height.saturating_sub(i as u32 * rps).min(rps);
        if rows_in_strip == 0 {
            break;
        }
        // FillOrder 2 stores the least-significant bit first; hayro expects MSB.
        let mut strip = data[start..end].to_vec();
        if fill_order == 2 {
            for b in strip.iter_mut() {
                *b = b.reverse_bits();
            }
        }
        let settings = DecodeSettings {
            columns: width,
            rows: rows_in_strip,
            end_of_block: true,
            end_of_line,
            rows_are_byte_aligned: byte_aligned,
            encoding,
            invert_black: false,
        };
        let mut ctx = DecoderContext::new(settings);
        collector.cur_x = 0;
        decode(&strip, &mut collector, &mut ctx)
            .map_err(|e| DecodeError::new(&format!("CCITT strip {} decode failed: {:?}", i, e)))?;
    }

    let mut pixels = collector.pixels;
    pixels.resize(expected, white_pel_value);

    // CCITT data is always bilevel grayscale (photometric_interpretation is 0
    // or 1 here, never 5), so `finalize_decode_bytes`'s CMYK step is a no-op
    // and only the Orientation transform actually does anything.
    let (pixels, width, height, channels) = finalize_decode_bytes(
        pixels,
        width,
        height,
        1,
        photometric_interpretation,
        orientation,
    );

    let (min, max) = compute_stats_u8(&pixels);

    Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample: 8,
        sample_format: 1,
        compression,
        predictor,
        photometric_interpretation,
        planar_configuration,
        rows_per_strip,
        strip_count: counts.len() as u32,
        strip_byte_count_total: counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: counts.iter().copied().max().unwrap_or(0),
        tile_width: 0,
        tile_length: 0,
        tile_count: 0,
        direct_decode: false,
        data: pixels,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
        all_tags_json: extract_all_tags_json(data),
        ome_xml: extract_ome_xml(data),
    })
}

/// Decode a chroma-subsampled YCbCr TIFF (PhotometricInterpretation 6 with a
/// `YCbCrSubSampling` other than 1x1) to interleaved RGB.
///
/// The tiff crate refuses these outright (`chroma subsampling of YCbCr color
/// is unsupported`). The layout is not a plain raster: samples are grouped
/// into `subsample_h x subsample_v` MCU-style units, each holding that many
/// luma samples followed by ONE Cb and ONE Cr shared by the whole unit. A
/// 4:2:0 image therefore stores 4 Y + 1 Cb + 1 Cr per 2x2 block, so a row of
/// units is not a row of pixels and the data cannot be walked linearly.
///
/// Only lossless compressions are handled here (none/LZW/Deflate). Old-style
/// JPEG (compression 6) is a different, deprecated container and is left to
/// report its own error.
#[allow(clippy::too_many_arguments)]
pub(crate) fn decode_ycbcr_subsampled(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    compression: u32,
    orientation: TiffOrientation,
) -> Result<TiffResult, DecodeError> {
    use tiff::tags::Tag;

    const CTX: &str = "Subsampled YCbCr TIFF";

    let subsampling = decoder
        .get_tag_u32_vec(Tag::Unknown(530))
        .unwrap_or_else(|_| vec![2, 2]);
    let sub_h = *subsampling.first().unwrap_or(&2) as usize;
    let sub_v = *subsampling.get(1).unwrap_or(&2) as usize;
    if sub_h == 0 || sub_v == 0 || sub_h > 4 || sub_v > 4 {
        return Err(DecodeError::new(&format!(
            "{}: unsupported YCbCrSubSampling {}x{}",
            CTX, sub_h, sub_v
        )));
    }

    let is_tiled = decoder.get_tag_u32(Tag::TileWidth).unwrap_or(0) > 0;
    // Units per block row/column, and how many pixels a unit covers.
    let units_across = (width as usize).div_ceil(sub_h);
    let unit_rows_total = (height as usize).div_ceil(sub_v);
    // Bytes per unit: sub_h*sub_v luma samples plus one Cb and one Cr.
    let unit_bytes = sub_h * sub_v + 2;

    let (offsets, counts, rows_per_block, block_width_units, blocks_across) = if is_tiled {
        let tile_width = decoder.get_tag_u32(Tag::TileWidth).unwrap_or(0) as usize;
        let tile_length = decoder.get_tag_u32(Tag::TileLength).unwrap_or(0) as usize;
        if tile_width == 0 || tile_length == 0 {
            return Err(DecodeError::new(&format!("{}: bad tile geometry", CTX)));
        }
        (
            decoder
                .get_tag_u64_vec(Tag::TileOffsets)
                .map_err(|e| DecodeError::new(&format!("{}: tile offsets: {}", CTX, e)))?,
            decoder
                .get_tag_u64_vec(Tag::TileByteCounts)
                .map_err(|e| DecodeError::new(&format!("{}: tile byte counts: {}", CTX, e)))?,
            tile_length.div_ceil(sub_v),
            tile_width.div_ceil(sub_h),
            width as usize / tile_width.max(1) + usize::from(width as usize % tile_width != 0),
        )
    } else {
        let rows_per_strip = decoder
            .get_tag_u32(Tag::RowsPerStrip)
            .unwrap_or(height)
            .max(1) as usize;
        (
            decoder
                .get_tag_u64_vec(Tag::StripOffsets)
                .map_err(|e| DecodeError::new(&format!("{}: strip offsets: {}", CTX, e)))?,
            decoder
                .get_tag_u64_vec(Tag::StripByteCounts)
                .map_err(|e| DecodeError::new(&format!("{}: strip byte counts: {}", CTX, e)))?,
            rows_per_strip.div_ceil(sub_v),
            units_across,
            1usize,
        )
    };

    let mut rgb = vec![0u8; (width as usize) * (height as usize) * 3];
    let mut unit_row_base = 0usize;
    let mut block_index = 0usize;

    while block_index < offsets.len() && unit_row_base < unit_rows_total {
        for block_col in 0..blocks_across {
            if block_index >= offsets.len() {
                break;
            }
            let start = offsets[block_index] as usize;
            let end = start.saturating_add(counts[block_index] as usize);
            block_index += 1;
            if end > data.len() {
                return Err(DecodeError::new(&format!("{}: block out of bounds", CTX)));
            }
            let rows_here = rows_per_block.min(unit_rows_total - unit_row_base);
            let expected = block_width_units * rows_here * unit_bytes;
            let block = super::strips::decompress_strip_or_tile(
                &data[start..end],
                compression,
                expected,
                CTX,
            )?;

            for unit_row in 0..rows_here {
                for unit_col in 0..block_width_units {
                    let unit_index = unit_row * block_width_units + unit_col;
                    let at = unit_index * unit_bytes;
                    if at + unit_bytes > block.len() {
                        continue;
                    }
                    let cb = block[at + sub_h * sub_v] as f32 - 128.0;
                    let cr = block[at + sub_h * sub_v + 1] as f32 - 128.0;
                    let global_unit_col = block_col * block_width_units + unit_col;
                    for luma_y in 0..sub_v {
                        for luma_x in 0..sub_h {
                            let y = block[at + luma_y * sub_h + luma_x] as f32;
                            let px = global_unit_col * sub_h + luma_x;
                            let py = (unit_row_base + unit_row) * sub_v + luma_y;
                            if px >= width as usize || py >= height as usize {
                                continue;
                            }
                            // CCIR 601-1 / JFIF inverse transform, which is what
                            // TIFF 6.0 specifies for the default YCbCrCoefficients.
                            let r = y + 1.402 * cr;
                            let g = y - 0.344_136 * cb - 0.714_136 * cr;
                            let b = y + 1.772 * cb;
                            let o = (py * width as usize + px) * 3;
                            rgb[o] = r.clamp(0.0, 255.0) as u8;
                            rgb[o + 1] = g.clamp(0.0, 255.0) as u8;
                            rgb[o + 2] = b.clamp(0.0, 255.0) as u8;
                        }
                    }
                }
            }
        }
        unit_row_base += rows_per_block;
    }

    let (rgb, width, height, channels) =
        finalize_decode_bytes(rgb, width, height, 3, 2, orientation);
    let (min, max) = compute_stats_u8(&rgb);
    Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample: 8,
        sample_format: 1,
        compression,
        predictor: 1,
        photometric_interpretation: 2, // expanded to RGB
        planar_configuration: 1,
        rows_per_strip: decoder.get_tag_u32(Tag::RowsPerStrip).unwrap_or(height),
        strip_count: counts.len() as u32,
        strip_byte_count_total: counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: counts.iter().copied().max().unwrap_or(0),
        tile_width: decoder.get_tag_u32(Tag::TileWidth).unwrap_or(0),
        tile_length: decoder.get_tag_u32(Tag::TileLength).unwrap_or(0),
        tile_count: if is_tiled { counts.len() as u32 } else { 0 },
        direct_decode: false,
        data: rgb,
        data_f32: Vec::new(),
        min_value: min as f64,
        max_value: max as f64,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
        all_tags_json: String::new(),
        ome_xml: String::new(),
    })
}

/// Decode an SGI Log-encoded TIFF (photometric 32844 `CIE Log2(L)` or 32845
/// `CIE Log2(Luv)`) to floating point.
///
/// These store HIGH DYNAMIC RANGE data: a 15-bit log2 luminance (plus, for
/// LogLuv, 8-bit u' and v' chromaticity). Neither the tiff crate nor tifffile
/// nor Pillow reads them, so both the container compression and the value
/// decoding are implemented here.
///
/// Compression 34676 (`SGILog`) is a run-length encoding applied to each BYTE
/// PLANE of the sample separately, most significant plane first — not to the
/// samples themselves. Compression 34677 (`SGILog24`) is raw 24-bit data with
/// no run-length layer at all.
///
/// The output is luminance in candela/m^2 (LogL) or linear RGB (LogLuv), which
/// is what a scientific viewer wants; libtiff's own `tiff2rgba` instead applies
/// a display tone map, so its 8-bit output is not the same quantity.
pub(crate) fn decode_sgilog(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    compression: u32,
    photometric: u32,
    orientation: TiffOrientation,
) -> Result<TiffResult, DecodeError> {
    use tiff::tags::Tag;

    const CTX: &str = "SGI Log TIFF";

    let rows_per_strip = decoder
        .get_tag_u32(Tag::RowsPerStrip)
        .unwrap_or(height)
        .max(1);
    let offsets = decoder
        .get_tag_u64_vec(Tag::StripOffsets)
        .map_err(|e| DecodeError::new(&format!("{}: strip offsets: {}", CTX, e)))?;
    let counts = decoder
        .get_tag_u64_vec(Tag::StripByteCounts)
        .map_err(|e| DecodeError::new(&format!("{}: strip byte counts: {}", CTX, e)))?;

    let is_luv = photometric == 32845;
    // LogL is one 16-bit sample per pixel. LogLuv is one 32-bit sample per
    // pixel under SGILog, or 24-bit under SGILog24.
    let sample_bytes: usize = if !is_luv {
        2
    } else if compression == 34677 {
        3
    } else {
        4
    };
    let pixels_per_row = width as usize;
    let out_channels = if is_luv { 3usize } else { 1 };
    let mut out = vec![0f32; pixels_per_row * height as usize * out_channels];

    let mut row_base = 0usize;
    for (index, (&offset, &count)) in offsets.iter().zip(counts.iter()).enumerate() {
        let start = offset as usize;
        let end = start.saturating_add(count as usize);
        if end > data.len() {
            return Err(DecodeError::new(&format!("{}: strip {} out of bounds", CTX, index)));
        }
        let rows_here = (rows_per_strip as usize).min(height as usize - row_base);
        if rows_here == 0 {
            break;
        }
        let block = &data[start..end];
        // One decoded sample per pixel, assembled plane by plane.
        let mut samples = vec![0u32; pixels_per_row * rows_here];

        if compression == 34677 {
            // SGILog24: raw big-endian 24-bit values, no run-length layer.
            for (i, slot) in samples.iter_mut().enumerate() {
                let at = i * 3;
                if at + 3 > block.len() {
                    break;
                }
                *slot = ((block[at] as u32) << 16) | ((block[at + 1] as u32) << 8) | block[at + 2] as u32;
            }
        } else {
            // SGILog: run-length over byte planes, most significant plane
            // first — and restarted for EVERY ROW, not once per strip. Running
            // the plane loop across the whole strip assembles bytes from
            // different rows into the same sample, which produced log
            // exponents in the thousands and luminances around 1e19.
            let mut cursor = 0usize;
            for row in 0..rows_here {
                let row_start = row * pixels_per_row;
                for plane in (0..sample_bytes).rev() {
                    let shift = (plane * 8) as u32;
                    let mut i = 0usize;
                    while i < pixels_per_row && cursor < block.len() {
                        let token = block[cursor];
                        cursor += 1;
                        if token >= 128 {
                            // Run: (token - 126) copies of the next byte.
                            let run = token as usize - 126;
                            if cursor >= block.len() {
                                break;
                            }
                            let value = block[cursor] as u32;
                            cursor += 1;
                            for _ in 0..run {
                                if i >= pixels_per_row {
                                    break;
                                }
                                samples[row_start + i] |= value << shift;
                                i += 1;
                            }
                        } else {
                            // Literal: `token` bytes follow verbatim.
                            let run = token as usize;
                            for _ in 0..run {
                                if i >= pixels_per_row || cursor >= block.len() {
                                    break;
                                }
                                samples[row_start + i] |= (block[cursor] as u32) << shift;
                                cursor += 1;
                                i += 1;
                            }
                        }
                    }
                }
            }
        }

        for (i, &raw) in samples.iter().enumerate() {
            let row = row_base + i / pixels_per_row;
            let col = i % pixels_per_row;
            if row >= height as usize || col >= pixels_per_row {
                continue;
            }
            let base = (row * pixels_per_row + col) * out_channels;
            if !is_luv {
                out[base] = logl16_to_luminance(raw as u16) as f32;
            } else {
                let (r, g, b) = logluv_to_rgb(raw, compression == 34677);
                out[base] = r as f32;
                out[base + 1] = g as f32;
                out[base + 2] = b as f32;
            }
        }
        row_base += rows_here;
    }

    // `apply_orientation` is generic over the sample type, so the float raster
    // reuses the same transform the byte paths use.
    let (out, width, height) =
        super::orientation::apply_orientation(&out, width, height, out_channels as u32, orientation);
    let channels = out_channels as u32;
    let (min, max) = (
        out.iter().copied().fold(f32::INFINITY, f32::min),
        out.iter().copied().fold(f32::NEG_INFINITY, f32::max),
    );
    Ok(TiffResult {
        width,
        height,
        channels,
        bits_per_sample: 32,
        sample_format: 3,
        compression,
        predictor: 1,
        photometric_interpretation: if is_luv { 2 } else { 1 },
        planar_configuration: 1,
        rows_per_strip,
        strip_count: counts.len() as u32,
        strip_byte_count_total: counts.iter().copied().sum::<u64>(),
        strip_byte_count_max: counts.iter().copied().max().unwrap_or(0),
        tile_width: 0,
        tile_length: 0,
        tile_count: 0,
        direct_decode: false,
        data: Vec::new(),
        data_f32: out,
        min_value: if min.is_finite() { min as f64 } else { 0.0 },
        max_value: if max.is_finite() { max as f64 } else { 0.0 },
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
        all_tags_json: String::new(),
        ome_xml: String::new(),
    })
}

/// 16-bit LogL sample -> luminance. Bit 15 is a sign, bits 0..14 a log2
/// luminance scaled by 256 and biased by 64.
fn logl16_to_luminance(p16: u16) -> f64 {
    let le = (p16 & 0x7fff) as f64;
    if le == 0.0 {
        return 0.0;
    }
    let y = ((le + 0.5) / 256.0 - 64.0).exp2();
    if p16 & 0x8000 == 0 {
        y
    } else {
        -y
    }
}

/// LogLuv sample -> linear RGB.
///
/// 32-bit layout: sign+15-bit log luminance, then 8-bit u' and 8-bit v'.
/// 24-bit layout: 10-bit log luminance and a 14-bit index into a chromaticity
/// table; the index is approximated here by the same u'v' reconstruction,
/// which is adequate for display but is not libtiff's exact lookup.
fn logluv_to_rgb(raw: u32, is_24bit: bool) -> (f64, f64, f64) {
    let (luminance, u_prime, v_prime) = if is_24bit {
        let le = (raw >> 14) & 0x3ff;
        let ce = raw & 0x3fff;
        let y = if le == 0 { 0.0 } else { ((le as f64 + 0.5) / 64.0 - 12.0).exp2() };
        // UV_SQSIZ / UV_NDIVS decomposition from the LogLuv specification.
        let vi = (ce / 163) as f64;
        let ui = (ce % 163) as f64;
        (y, (ui + 0.5) * 0.003_25 + 0.0, (vi + 0.5) * 0.003_25 + 0.0)
    } else {
        let le = (raw >> 16) & 0x7fff;
        let y = if le == 0 { 0.0 } else { ((le as f64 + 0.5) / 256.0 - 64.0).exp2() };
        let u = ((raw >> 8) & 0xff) as f64;
        let v = (raw & 0xff) as f64;
        (y, (u + 0.5) / 410.0, (v + 0.5) / 410.0)
    };
    if luminance <= 0.0 || v_prime <= 0.0 {
        return (0.0, 0.0, 0.0);
    }
    // u'v' -> CIE XYZ at the given luminance.
    let x = 9.0 * u_prime / (6.0 * u_prime - 16.0 * v_prime + 12.0);
    let y_chroma = 4.0 * v_prime / (6.0 * u_prime - 16.0 * v_prime + 12.0);
    if y_chroma <= 0.0 {
        return (0.0, 0.0, 0.0);
    }
    let big_x = x / y_chroma * luminance;
    let big_z = (1.0 - x - y_chroma) / y_chroma * luminance;
    // CIE XYZ -> linear sRGB primaries (the same matrix libtiff uses).
    let r = 2.690 * big_x - 1.276 * luminance - 0.414 * big_z;
    let g = -1.022 * big_x + 1.978 * luminance + 0.044 * big_z;
    let b = 0.061 * big_x - 0.224 * luminance + 1.163 * big_z;
    (r.max(0.0), g.max(0.0), b.max(0.0))
}

